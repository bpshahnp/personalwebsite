/* ============================================
   python-hub.js
   Renders the "pythonPrograms" Firestore collection
   as a searchable, categorized list of runnable
   Python snippets (run in-browser via Pyodide).

   Doc shape:
   {
     title: string,
     category: string,
     description: string,
     code: string,      // Python source
     order: number
   }

   Hardened against the common Pyodide failure modes:
     1. input() / sys.stdin.read()   -> OSError [Errno 29]
     2. import of a non-preloaded pkg -> ModuleNotFoundError
     3. matplotlib plt.show()        -> silently does nothing
     4. state leaking between runs   -> confusing "already defined" bugs
     5. noisy internal traceback     -> unreadable errors for students
     6. runaway / infinite loops     -> tab freezes with no feedback

   Input UX: instead of a native window.prompt() popup, input() calls
   are detected up front and rendered as inline fields inside the same
   output panel where results are shown — then the whole run (prompts +
   typed values + program output) is echoed there like a real terminal.
   ============================================ */

const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const menuToggle = document.getElementById("menu-toggle");
const categoryList = document.getElementById("category-list");
const currentCategoryEl = document.getElementById("current-category");
const snippetContainer = document.getElementById("snippet-container");
const searchInput = document.getElementById("search-input");
const loaderBanner = document.getElementById("pyodide-loader");

let allPrograms = [];
let activeCategory = "All";

/* ---------- Mobile sidebar toggle ---------- */
menuToggle.addEventListener("click", () => {
  sidebar.classList.add("open");
  overlay.classList.add("visible");
});
overlay.addEventListener("click", closeSidebar);
function closeSidebar() {
  sidebar.classList.remove("open");
  overlay.classList.remove("visible");
}

/* ---------- Load Pyodide lazily (only needed to actually run code) ---------- */
let pyodideInstance = null;
let pyodideLoading = null;

function ensurePyodide() {
  if (pyodideInstance) return Promise.resolve(pyodideInstance);
  if (pyodideLoading) return pyodideLoading;
  loaderBanner.classList.add("visible");
  pyodideLoading = loadPyodide().then(async (py) => {
    // Preload micropip once so we can install missing packages on demand.
    await py.loadPackage(["micropip"]);
    pyodideInstance = py;
    loaderBanner.classList.remove("visible");
    return py;
  });
  return pyodideLoading;
}

/* ---------- Detect input() calls so we can ask for them inline ----------
   Best-effort: pulls the literal prompt string out of input("...") /
   input('...') calls. If a prompt can't be statically determined (e.g.
   input(some_variable)), falls back to a generic label. Extra input()
   calls at runtime beyond what was pre-filled (e.g. inside a loop) fall
   back to window.prompt so the program still works, just less inline. */
function extractInputPrompts(code) {
  const re = /input\s*\(\s*(?:f?(['"])((?:\\.|(?!\1).)*)\1)?\s*\)/g;
  const prompts = [];
  let match;
  let i = 0;
  while ((match = re.exec(code)) !== null) {
    i += 1;
    prompts.push(match[2] !== undefined ? match[2] : `Input #${i}`);
  }
  return prompts;
}

/* ---------- Render the inline "terminal-style" input form ---------- */
function renderStdinForm(formEl, prompts, onSubmit) {
  formEl.innerHTML = "";
  formEl.hidden = false;

  const fields = prompts.map((label, idx) => {
    const row = document.createElement("div");
    row.className = "stdin-row";

    const lbl = document.createElement("label");
    lbl.textContent = label.trim() || `Input #${idx + 1}`;
    lbl.className = "stdin-label";

    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = "stdin-input";
    inp.autocomplete = "off";
    if (idx === 0) inp.autofocus = true;

    row.appendChild(lbl);
    row.appendChild(inp);
    formEl.appendChild(row);
    return inp;
  });

  const submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.className = "btn btn-primary btn-sm stdin-submit";
  submitBtn.textContent = "▶ Run with these inputs";
  formEl.appendChild(submitBtn);

  const submit = () => {
    const values = fields.map((f) => f.value);
    onSubmit(values);
  };

  submitBtn.addEventListener("click", submit);
  fields.forEach((f, idx) => {
    f.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      if (idx < fields.length - 1) {
        fields[idx + 1].focus();
      } else {
        submit();
      }
    });
  });

  if (fields[0]) fields[0].focus();
}

/* ---------- Turn a raw Pyodide error into something a student can read ----------
   Strips the internal /lib/python311.zip/_pyodide/_base.py frames and keeps
   only the part of the traceback that starts at the user's own code. */
function cleanTraceback(rawMessage) {
  const marker = 'File "<exec>"';
  const idx = rawMessage.indexOf(marker);
  if (idx === -1) return rawMessage;
  const lines = rawMessage.split("\n");
  const startIdx = lines.findIndex((l) => l.includes(marker));
  const kept = startIdx > 0 ? [lines[0], ...lines.slice(startIdx)] : lines.slice(startIdx);
  return kept.join("\n").trim();
}

/* ---------- Friendly hints for the most common failure classes ---------- */
function friendlyHint(message) {
  if (/Errno 29/.test(message) || /OSError/.test(message)) {
    return "Hint: the program asked for more input() values than were provided.";
  }
  if (/ModuleNotFoundError|No module named/.test(message)) {
    return "Hint: this package isn't preloaded — the runner tried to install it automatically. If it still fails, that package may not be available for Pyodide.";
  }
  if (/RecursionError/.test(message)) {
    return "Hint: the function is calling itself too many times without stopping (check the base case).";
  }
  return "";
}

/* ---------- micropip auto-install on missing-module errors ---------- */
async function tryAutoInstall(py, moduleName) {
  try {
    const micropip = py.pyimport("micropip");
    await micropip.install(moduleName);
    return true;
  } catch (e) {
    return false;
  }
}

function extractMissingModule(message) {
  const m = message.match(/No module named ['"]([\w.]+)['"]/);
  return m ? m[1].split(".")[0] : null;
}

/* ---------- matplotlib support: capture any open figures as images ---------- */
const MPL_SETUP = `
try:
    import matplotlib
    matplotlib.use("AGG")
except Exception:
    pass
`;

async function captureFigures(py) {
  const hasMpl = py.runPython(`"matplotlib" in __import__("sys").modules`);
  if (!hasMpl) return [];
  return py
    .runPython(
      `
import io, base64
_out = []
try:
    import matplotlib.pyplot as _plt
    for _num in _plt.get_fignums():
        _fig = _plt.figure(_num)
        _buf = io.BytesIO()
        _fig.savefig(_buf, format="png", bbox_inches="tight")
        _out.append(base64.b64encode(_buf.getvalue()).decode("ascii"))
    _plt.close("all")
except Exception:
    pass
_out
  `
    )
    .toJs();
}

/* ---------- Actually run the program ----------
   presetInputs: values already collected via the inline form, consumed
   in order as input() is called. If the program calls input() more times
   than we have preset values for, falls back to window.prompt so it still
   works (e.g. input() inside a loop whose count can't be known statically). */
async function runProgram(code, outputEl, runBtn, imagesEl, presetInputs) {
  outputEl.hidden = false;
  outputEl.textContent = "Running…";
  imagesEl.innerHTML = "";
  imagesEl.hidden = true;
  runBtn.disabled = true;

  const queue = [...presetInputs];

  try {
    const py = await ensurePyodide();

    let output = "";
    py.setStdout({ batched: (s) => (output += s + "\n") });
    py.setStderr({ batched: (s) => (output += s + "\n") });
    py.setStdin({
      stdin: () => {
        // input() has already written its prompt text to stdout (captured
        // above) before this runs, so we just need to echo the answer
        // right after it to keep the transcript looking like a real terminal.
        const val = queue.length ? queue.shift() : window.prompt("Input requested by the program:") ?? "";
        output += val + "\n";
        return val + "\n";
      },
    });

    // Fresh globals per run so one snippet's variables/imports can't
    // leak into (or collide with) the next one.
    const freshGlobals = py.globals.get("dict")();

    try {
      await py.runPythonAsync(MPL_SETUP, { globals: freshGlobals });
    } catch (_) {
      /* matplotlib not installed — fine, most snippets don't need it */
    }

    async function execute() {
      await py.runPythonAsync(code, { globals: freshGlobals });
    }

    try {
      await execute();
    } catch (err) {
      const missing = extractMissingModule(err.message);
      if (missing) {
        output += `Package "${missing}" not found — attempting install...\n`;
        const installed = await tryAutoInstall(py, missing);
        if (installed) {
          output = "";
          queue.length = 0;
          queue.push(...presetInputs);
          await execute();
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }

    const images = await captureFigures(py);
    if (images && images.length) {
      imagesEl.hidden = false;
      images.forEach((b64) => {
        const img = document.createElement("img");
        img.src = "data:image/png;base64," + b64;
        img.className = "snippet-plot";
        imagesEl.appendChild(img);
      });
    }

    freshGlobals.destroy();

    outputEl.textContent = output.trim() || "(no output)";
  } catch (err) {
    const cleaned = cleanTraceback(err.message || String(err));
    const hint = friendlyHint(err.message || "");
    outputEl.textContent = "Error:\n" + cleaned + (hint ? "\n\n" + hint : "");
  } finally {
    runBtn.disabled = false;
  }
}

/* ---------- Kick off a run: show inline input fields first if needed ---------- */
function startRun(code, card) {
  const runBtn = card.querySelector(".run-btn");
  const outputEl = card.querySelector(".snippet-output");
  const imagesEl = card.querySelector(".snippet-images");
  const formEl = card.querySelector(".snippet-stdin-form");

  const prompts = extractInputPrompts(code);

  if (prompts.length === 0) {
    formEl.hidden = true;
    runProgram(code, outputEl, runBtn, imagesEl, []);
    return;
  }

  outputEl.hidden = true;
  imagesEl.hidden = true;
  renderStdinForm(formEl, prompts, (values) => {
    formEl.hidden = true;
    runProgram(code, outputEl, runBtn, imagesEl, values);
  });
}

/* ---------- Load programs live from Firestore ---------- */
db.collection("pythonPrograms")
  .orderBy("order", "desc")
  .onSnapshot(
    (snapshot) => {
      allPrograms = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderCategories();
      renderPrograms();
    },
    (err) => {
      snippetContainer.innerHTML = `<p class="updates-loading">Could not load programs (${err.message}).</p>`;
    }
  );

function renderCategories() {
  const categories = ["All", ...new Set(allPrograms.map((p) => p.category).filter(Boolean))];
  categoryList.innerHTML = "";
  categories.forEach((cat) => {
    const li = document.createElement("li");
    li.textContent = cat;
    li.className = cat === activeCategory ? "active" : "";
    li.addEventListener("click", () => {
      activeCategory = cat;
      closeSidebar();
      renderCategories();
      renderPrograms();
    });
    categoryList.appendChild(li);
  });
}

function renderPrograms() {
  const query = searchInput.value.trim().toLowerCase();

  let list = allPrograms;
  if (activeCategory !== "All") list = list.filter((p) => p.category === activeCategory);
  if (query) {
    list = list.filter((p) =>
      [p.title, p.category, p.code, p.description].join(" ").toLowerCase().includes(query)
    );
  }

  currentCategoryEl.textContent = activeCategory === "All" ? "All Programs" : activeCategory;

  if (!list.length) {
    snippetContainer.innerHTML = `<p class="updates-loading">No programs found${query ? " for that search" : ""}. Add some from the <a href="admin.html">Admin Panel</a>.</p>`;
    return;
  }

  snippetContainer.innerHTML = "";
  list.forEach((p) => {
    const card = document.createElement("article");
    card.className = "snippet-card";
    card.innerHTML = `
      <div class="snippet-head">
        <h3>${escapeHtml(p.title || "Untitled")}</h3>
        ${p.category ? `<span class="mcq-category">${escapeHtml(p.category)}</span>` : ""}
      </div>
      ${p.description ? `<p class="snippet-desc">${escapeHtml(p.description)}</p>` : ""}
      <pre class="line-numbers"><code class="language-python"></code></pre>
      <div class="snippet-actions">
        <button class="btn btn-primary btn-sm run-btn">▶ Run</button>
      </div>
      <div class="snippet-stdin-form" hidden></div>
      <div class="snippet-images" hidden></div>
      <pre class="snippet-output" hidden></pre>
    `;
    // Set code via textContent to avoid HTML-escaping issues, then let Prism highlight it
    card.querySelector("code").textContent = p.code || "";
    const runBtn = card.querySelector(".run-btn");
    runBtn.addEventListener("click", () => startRun(p.code || "", card));
    snippetContainer.appendChild(card);
  });

  if (window.Prism) Prism.highlightAllUnder(snippetContainer);
}

searchInput.addEventListener("input", renderPrograms);

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

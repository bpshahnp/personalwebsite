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

   Input UX matches the PythonHub reference: a single main-thread
   Pyodide instance, no Worker, no SharedArrayBuffer/service-worker
   setup required. input() prompts are detected up front, printed into
   the output box, and answered one at a time via a small inline field
   that appears right after the prompt — same as the reference.

   Fix vs. the reference: the reference only reads the FIRST input()
   prompt and then substitutes that single value into every input()
   call in the code, which is wrong for snippets with more than one
   input() (e.g. two numbers to compare — both would get the same
   value). Here each prompt is collected separately, in order, and fed
   to Python's real stdin one at a time, so multi-input snippets work
   correctly too.

   Also kept from before: auto-install missing packages via micropip,
   matplotlib figures captured as images, fresh globals per run (no
   state leaking between snippets), and cleaned-up tracebacks.
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
    await py.loadPackage(["micropip"]);
    pyodideInstance = py;
    loaderBanner.classList.remove("visible");
    return py;
  });
  return pyodideLoading;
}

/* ---------- Detect input() calls so we can ask for them inline ----------
   Best-effort: pulls the literal prompt string out of input("...") /
   input('...') calls, in source order. Falls back to a generic label
   when the prompt isn't a plain string literal (e.g. input(some_var)). */
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

/* ---------- One inline field, appended right where the prompt printed ----------
   Resolves with the typed value on Enter. Styled to blend into the
   terminal-style output rather than look like a form field. */
function collectInlineInput(outputEl) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "stdin-inline";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.size = 1;
    outputEl.appendChild(input);
    input.focus();
    outputEl.scrollTop = outputEl.scrollHeight;

    input.addEventListener("input", () => {
      input.size = Math.max(1, input.value.length);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const value = input.value;
      input.remove();
      resolve(value);
    });
  });
}

/* ---------- Turn a raw Pyodide error into something a student can read ---------- */
function cleanTraceback(rawMessage) {
  const marker = 'File "<exec>"';
  const idx = rawMessage.indexOf(marker);
  if (idx === -1) return rawMessage;
  const lines = rawMessage.split("\n");
  const startIdx = lines.findIndex((l) => l.includes(marker));
  const kept = startIdx > 0 ? [lines[0], ...lines.slice(startIdx)] : lines.slice(startIdx);
  return kept.join("\n").trim();
}

function friendlyHint(message) {
  if (/ModuleNotFoundError|No module named/.test(message)) {
    return "Hint: this package isn't preloaded — the runner tried to install it automatically. If it still fails, that package may not be available for Pyodide.";
  }
  if (/RecursionError/.test(message)) {
    return "Hint: the function is calling itself too many times without stopping (check the base case).";
  }
  return "";
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

/* ---------- Run a snippet ---------- */
async function runProgram(code, outputEl, runBtn, imagesEl) {
  outputEl.hidden = false;
  outputEl.textContent = "";
  imagesEl.hidden = true;
  imagesEl.innerHTML = "";
  runBtn.disabled = true;

  try {
    const py = await ensurePyodide();

    // Collect every input() value up front, one field at a time, inline
    // in the output box — in source order, so multi-input snippets work.
    const prompts = extractInputPrompts(code);
    const values = [];
    for (const label of prompts) {
      outputEl.textContent += label;
      const val = await collectInlineInput(outputEl);
      values.push(val);
      outputEl.textContent += val + "\n";
    }

    const queue = [...values];
    let output = "";
    py.setStdout({ batched: (s) => (output += s + "\n") });
    py.setStderr({ batched: (s) => (output += s + "\n") });
    py.setStdin({ stdin: () => (queue.length ? queue.shift() : "") + "\n" });

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
        try {
          const micropip = py.pyimport("micropip");
          await micropip.install(missing);
          output = "";
          queue.length = 0;
          queue.push(...values);
          await execute();
        } catch (e2) {
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

    // input() writes its own prompt text to real stdout when it actually
    // runs — we already showed that same prompt during collection above,
    // so remove the duplicate (wherever it landed) before displaying the rest.
    for (const label of prompts) {
      const idx = output.indexOf(label);
      if (idx !== -1) output = output.slice(0, idx) + output.slice(idx + label.length);
    }

    outputEl.textContent += output.trim() || "(no output)";
  } catch (err) {
    const cleaned = cleanTraceback(err.message || String(err));
    const hint = friendlyHint(err.message || "");
    outputEl.textContent += "\nError:\n" + cleaned + (hint ? "\n\n" + hint : "");
  } finally {
    runBtn.disabled = false;
  }
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
      <div class="snippet-code-wrap">
        <pre class="line-numbers"><code class="language-python"></code></pre>
      </div>
      <div class="snippet-actions">
        <button class="btn btn-primary btn-sm run-btn">▶ Run</button>
        <button class="btn btn-outline btn-sm edit-btn">✏️ Edit</button>
        <button class="btn btn-outline btn-sm reset-btn" hidden>↺ Reset</button>
      </div>
      <div class="snippet-images" hidden></div>
      <div class="snippet-output snippet-terminal" hidden></div>
    `;

    const originalCode = p.code || "";
    let currentCode = originalCode;
    let editing = false;

    const codeWrap = card.querySelector(".snippet-code-wrap");
    const runBtn = card.querySelector(".run-btn");
    const editBtn = card.querySelector(".edit-btn");
    const resetBtn = card.querySelector(".reset-btn");
    const outputEl = card.querySelector(".snippet-output");
    const imagesEl = card.querySelector(".snippet-images");

    function showHighlighted() {
      codeWrap.innerHTML = `<pre class="line-numbers"><code class="language-python"></code></pre>`;
      const codeEl = codeWrap.querySelector("code");
      codeEl.textContent = currentCode;
      if (window.Prism) Prism.highlightElement(codeEl);
    }

    function enterEditMode() {
      const textarea = document.createElement("textarea");
      textarea.className = "code-editor";
      textarea.spellcheck = false;
      textarea.value = currentCode;
      textarea.rows = Math.max(4, currentCode.split("\n").length);
      codeWrap.innerHTML = "";
      codeWrap.appendChild(textarea);
      textarea.focus();
      editBtn.textContent = "💾 Save";
      resetBtn.hidden = false;
      editing = true;
    }

    function saveEdits() {
      const textarea = codeWrap.querySelector("textarea");
      if (textarea) currentCode = textarea.value;
      showHighlighted();
      editBtn.textContent = "✏️ Edit";
      resetBtn.hidden = true;
      editing = false;
    }

    editBtn.addEventListener("click", () => (editing ? saveEdits() : enterEditMode()));

    resetBtn.addEventListener("click", () => {
      currentCode = originalCode;
      if (editing) {
        codeWrap.querySelector("textarea").value = currentCode;
      } else {
        showHighlighted();
      }
    });

    runBtn.addEventListener("click", () => {
      if (editing) saveEdits(); // use whatever's currently typed
      runProgram(currentCode, outputEl, runBtn, imagesEl);
    });

    showHighlighted();
    snippetContainer.appendChild(card);
  });
}

searchInput.addEventListener("input", renderPrograms);

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

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

   INTERACTIVE MODE (preferred, Thonny-style):
   When the page is crossOriginIsolated (see coi-serviceworker.js),
   code runs in pyodide-worker.js, a Web Worker that genuinely pauses
   Python execution on input() via Atomics.wait and resumes it with
   whatever the user types into an inline field that appears right in
   the output stream — output and input interleave exactly as they
   would in a real terminal.

   FALLBACK MODE:
   If SharedArrayBuffer / crossOriginIsolated isn't available (e.g. the
   service worker hasn't installed yet), input() calls are detected up
   front and collected via a small inline form before running, then the
   whole transcript is shown at once. Less faithful, but always works.

   Both modes also handle: missing packages (auto-install via micropip),
   matplotlib figures (captured as images), fresh globals per run (no
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

const INTERACTIVE_SUPPORTED =
  typeof SharedArrayBuffer !== "undefined" && typeof window !== "undefined" && window.crossOriginIsolated;

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

/* =====================================================
   INTERACTIVE MODE — shared worker, blocking stdin
   ===================================================== */

let sharedWorker = null;
let workerBusy = false;

function ensureWorker() {
  if (!sharedWorker) {
    sharedWorker = new Worker("pyodide-worker.js");
    loaderBanner.classList.add("visible"); // first run loads the ~10MB runtime
  }
  return sharedWorker;
}

function setAllRunButtonsDisabled(disabled) {
  document.querySelectorAll(".run-btn").forEach((btn) => (btn.disabled = disabled));
}

function runInteractive(code, outputEl, runBtn, imagesEl) {
  if (workerBusy) return; // one run at a time (shared worker/runtime)
  workerBusy = true;
  setAllRunButtonsDisabled(true);

  outputEl.hidden = false;
  outputEl.innerHTML = "";
  imagesEl.hidden = true;
  imagesEl.innerHTML = "";

  const sab = new SharedArrayBuffer(8 + 4096);
  const sync = new Int32Array(sab, 0, 2);
  const inputBytes = new Uint8Array(sab, 8);

  const w = ensureWorker();
  loaderBanner.classList.remove("visible");

  function appendText(text) {
    outputEl.appendChild(document.createTextNode(text));
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  function showInlineInput() {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "stdin-inline";
    input.autocomplete = "off";
    outputEl.appendChild(input);
    input.focus();
    outputEl.scrollTop = outputEl.scrollHeight;

    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const value = input.value;
      const bytes = new TextEncoder().encode(value).subarray(0, 4096);
      inputBytes.set(bytes);
      Atomics.store(sync, 1, bytes.length);
      input.replaceWith(document.createTextNode(value + "\n"));
      outputEl.scrollTop = outputEl.scrollHeight;
      Atomics.store(sync, 0, 1);
      Atomics.notify(sync, 0);
    });
  }

  function cleanup() {
    w.removeEventListener("message", onMessage);
    workerBusy = false;
    setAllRunButtonsDisabled(false);
  }

  function onMessage(event) {
    const msg = event.data;
    if (msg.type === "stdout") {
      appendText(msg.text);
    } else if (msg.type === "input-request") {
      showInlineInput();
    } else if (msg.type === "done") {
      cleanup();
      if (!outputEl.textContent.trim()) appendText("(no output)");
      if (msg.images && msg.images.length) {
        imagesEl.hidden = false;
        msg.images.forEach((b64) => {
          const img = document.createElement("img");
          img.src = "data:image/png;base64," + b64;
          img.className = "snippet-plot";
          imagesEl.appendChild(img);
        });
      }
    } else if (msg.type === "error") {
      cleanup();
      const cleaned = cleanTraceback(msg.message);
      const hint = friendlyHint(msg.message);
      appendText("\nError:\n" + cleaned + (hint ? "\n\n" + hint : ""));
    }
  }

  w.addEventListener("message", onMessage);
  w.postMessage({ type: "run", code, sab });
}

/* =====================================================
   FALLBACK MODE — main-thread Pyodide, pre-collected inputs
   ===================================================== */

let pyodideInstance = null;
let pyodideLoading = null;

function ensurePyodideMainThread() {
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

  const submit = () => onSubmit(fields.map((f) => f.value));
  submitBtn.addEventListener("click", submit);
  fields.forEach((f, idx) => {
    f.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      if (idx < fields.length - 1) fields[idx + 1].focus();
      else submit();
    });
  });
  if (fields[0]) fields[0].focus();
}

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

function extractMissingModule(message) {
  const m = message.match(/No module named ['"]([\w.]+)['"]/);
  return m ? m[1].split(".")[0] : null;
}

async function runProgramFallback(code, outputEl, runBtn, imagesEl, presetInputs) {
  outputEl.hidden = false;
  outputEl.textContent = "Running…";
  imagesEl.innerHTML = "";
  imagesEl.hidden = true;
  runBtn.disabled = true;

  const queue = [...presetInputs];

  try {
    const py = await ensurePyodideMainThread();
    let output = "";
    py.setStdout({ batched: (s) => (output += s + "\n") });
    py.setStderr({ batched: (s) => (output += s + "\n") });
    py.setStdin({
      stdin: () => {
        const val = queue.length ? queue.shift() : window.prompt("Input requested by the program:") ?? "";
        output += val + "\n";
        return val + "\n";
      },
    });

    const freshGlobals = py.globals.get("dict")();
    try {
      await py.runPythonAsync(MPL_SETUP, { globals: freshGlobals });
    } catch (_) {}

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
          queue.push(...presetInputs);
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
    outputEl.textContent = output.trim() || "(no output)";
  } catch (err) {
    const cleaned = cleanTraceback(err.message || String(err));
    const hint = friendlyHint(err.message || "");
    outputEl.textContent = "Error:\n" + cleaned + (hint ? "\n\n" + hint : "");
  } finally {
    runBtn.disabled = false;
  }
}

/* =====================================================
   Shared helpers
   ===================================================== */

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

/* ---------- Kick off a run ---------- */
function startRun(code, card) {
  const runBtn = card.querySelector(".run-btn");
  const outputEl = card.querySelector(".snippet-output");
  const imagesEl = card.querySelector(".snippet-images");
  const formEl = card.querySelector(".snippet-stdin-form");
  formEl.hidden = true;

  if (INTERACTIVE_SUPPORTED) {
    runInteractive(code, outputEl, runBtn, imagesEl);
    return;
  }

  // Fallback: pre-collect inputs via inline form, then run all at once.
  const prompts = extractInputPrompts(code);
  if (prompts.length === 0) {
    runProgramFallback(code, outputEl, runBtn, imagesEl, []);
  } else {
    outputEl.hidden = true;
    renderStdinForm(formEl, prompts, (values) => {
      formEl.hidden = true;
      runProgramFallback(code, outputEl, runBtn, imagesEl, values);
    });
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
      <pre class="line-numbers"><code class="language-python"></code></pre>
      <div class="snippet-actions">
        <button class="btn btn-primary btn-sm run-btn">▶ Run</button>
      </div>
      <div class="snippet-stdin-form" hidden></div>
      <div class="snippet-images" hidden></div>
      <div class="snippet-output snippet-terminal" hidden></div>
    `;
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

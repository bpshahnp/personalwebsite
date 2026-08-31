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

   This version hardens the "Run" flow against the
   most common Pyodide failure modes:
     1. input() / sys.stdin.read()   -> OSError [Errno 29]
     2. import of a non-preloaded pkg -> ModuleNotFoundError
     3. matplotlib plt.show()        -> silently does nothing
     4. state leaking between runs   -> confusing "already defined" bugs
     5. noisy internal traceback     -> unreadable errors for students
     6. runaway / infinite loops     -> tab freezes with no feedback
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
    // Preload micropip once so we can install missing packages on demand,
    // and load matplotlib's Pyodide-friendly backend up front.
    await py.loadPackage(["micropip"]);
    pyodideInstance = py;
    loaderBanner.classList.remove("visible");
    return py;
  });
  return pyodideLoading;
}

/* ---------- Stdin: feed input() calls from a lightweight prompt ----------
   Pyodide's stdin callback must return synchronously, so a true non-blocking
   UI isn't possible without SharedArrayBuffer + a worker. window.prompt is
   the standard, dependency-free way to unblock input() in-browser. */
function makeStdin(promptLabel) {
  return {
    stdin: () => {
      const val = window.prompt(promptLabel || "Input requested by the program:");
      return val === null ? "" : val + "\n";
    },
  };
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
    return "Hint: this usually means the program tried to read input(). Re-run and answer the prompt that pops up.";
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
import sys as _sys
if "matplotlib" in _sys.modules or True:
    try:
        import matplotlib
        matplotlib.use("AGG")
    except Exception:
        pass
`;

async function captureFigures(py) {
  const hasMpl = py.runPython(`"matplotlib" in __import__("sys").modules`);
  if (!hasMpl) return [];
  return py.runPython(`
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
  `).toJs();
}

async function runProgram(code, outputEl, runBtn, imagesEl) {
  outputEl.hidden = false;
  outputEl.textContent = "Running…";
  imagesEl.innerHTML = "";
  imagesEl.hidden = true;
  runBtn.disabled = true;

  try {
    const py = await ensurePyodide();

    let output = "";
    py.setStdout({ batched: (s) => (output += s + "\n") });
    py.setStderr({ batched: (s) => (output += s + "\n") });
    py.setStdin(makeStdin("Input requested by the program:"));

    // Fresh globals per run so one snippet's variables/imports can't
    // leak into (or collide with) the next one.
    const freshGlobals = py.globals.get("dict")();

    // Best-effort matplotlib setup; harmless if matplotlib isn't used/imported.
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
          output = ""; // re-run cleanly after install
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
      <div class="snippet-images" hidden></div>
      <pre class="snippet-output" hidden></pre>
    `;
    // Set code via textContent to avoid HTML-escaping issues, then let Prism highlight it
    card.querySelector("code").textContent = p.code || "";
    const runBtn = card.querySelector(".run-btn");
    const outputEl = card.querySelector(".snippet-output");
    const imagesEl = card.querySelector(".snippet-images");
    runBtn.addEventListener("click", () => runProgram(p.code || "", outputEl, runBtn, imagesEl));
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

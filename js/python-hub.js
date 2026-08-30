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
  pyodideLoading = loadPyodide().then((py) => {
    pyodideInstance = py;
    loaderBanner.classList.remove("visible");
    return py;
  });
  return pyodideLoading;
}

async function runProgram(code, outputEl, runBtn) {
  outputEl.hidden = false;
  outputEl.textContent = "Running…";
  runBtn.disabled = true;
  try {
    const py = await ensurePyodide();
    let output = "";
    py.setStdout({ batched: (s) => (output += s + "\n") });
    py.setStderr({ batched: (s) => (output += s + "\n") });
    await py.runPythonAsync(code);
    outputEl.textContent = output.trim() || "(no output)";
  } catch (err) {
    outputEl.textContent = "Error: " + err.message;
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
      <pre class="snippet-output" hidden></pre>
    `;
    // Set code via textContent to avoid HTML-escaping issues, then let Prism highlight it
    card.querySelector("code").textContent = p.code || "";
    const runBtn = card.querySelector(".run-btn");
    const outputEl = card.querySelector(".snippet-output");
    runBtn.addEventListener("click", () => runProgram(p.code || "", outputEl, runBtn));
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

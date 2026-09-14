/* ============================================
   python-hub.js
   Split-view Python Hub: program rail on the left,
   one editor window on the right.

   Reads the "pythonPrograms" Firestore collection:
   { title, category, description, code, order }

   The Pyodide engine below is unchanged in behaviour: a single
   main-thread instance (no Worker, no SharedArrayBuffer, no
   service worker), micropip auto-install for missing packages,
   matplotlib figures captured as images, fresh globals per run,
   cleaned-up tracebacks, and input() prompts collected in source
   order and fed to real stdin one at a time so snippets with more
   than one input() get the right value in each.
   ============================================ */

/* ---------- Elements ---------- */
const railToggle = document.getElementById("railToggle");
const programRail = document.getElementById("programRail");
const overlay = document.getElementById("overlay");
const railList = document.getElementById("rail-list");
const railCount = document.getElementById("rail-count");
const searchInput = document.getElementById("search-input");
const workspace = document.getElementById("workspace");

/* ---------- State ---------- */
let allPrograms = [];
let selectedId = null;
let currentCode = "";   // what the code panel shows right now (may be edited)
let editing = false;
let running = false;

const MODKEY =
  typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform || "")
    ? "⌘"
    : "Ctrl";

/* ---------- Program rail as a drawer (small screens) ---------- */
function openRail() {
  programRail.classList.add("open");
  overlay.classList.add("visible");
  railToggle.setAttribute("aria-expanded", "true");
}
function closeRail() {
  programRail.classList.remove("open");
  overlay.classList.remove("visible");
  railToggle.setAttribute("aria-expanded", "false");
}
railToggle.addEventListener("click", () =>
  programRail.classList.contains("open") ? closeRail() : openRail()
);
overlay.addEventListener("click", closeRail);

/* ---------- Small helpers ---------- */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function slugify(str) {
  return String(str == null ? "" : str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* "Binary search" -> "binary_search.py" — the name a student would save it
   under, which also tells them what the file is called when it runs. */
function fileNameFor(program) {
  const base = slugify(program && program.title).replace(/-/g, "_");
  return (base || "program") + ".py";
}

function programById(id) {
  return allPrograms.find((p) => p.id === id) || null;
}

function originalCodeOf(id, list) {
  const hit = (list || allPrograms).find((p) => p.id === id);
  return (hit && hit.code) || "";
}

/* ---------- Filtering + grouping ---------- */
function visiblePrograms() {
  const query = (searchInput.value || "").trim().toLowerCase();
  if (!query) return allPrograms;
  return allPrograms.filter((p) =>
    [p.title, p.category, p.description, p.code]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query)
  );
}

function groupByCategory(list) {
  const groups = new Map();
  list.forEach((p) => {
    const key = ((p.category || "").trim()) || "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  });
  return groups;
}

/* ---------- The rail ---------- */
function renderRail() {
  const list = visiblePrograms();
  const total = allPrograms.length;

  railCount.textContent = !total
    ? "No programs yet"
    : list.length === total
    ? total + (total === 1 ? " program" : " programs")
    : list.length + " of " + total;

  railList.innerHTML = "";

  if (!list.length) {
    const note = document.createElement("p");
    note.className = "rail-empty";
    if (!total) {
      note.textContent = "Nothing here yet.";
    } else {
      note.textContent = "Nothing matches that search.";
      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "rail-clear";
      clear.textContent = "Clear search";
      clear.addEventListener("click", () => {
        searchInput.value = "";
        renderRail();
        searchInput.focus();
      });
      note.appendChild(clear);
    }
    railList.appendChild(note);
    return;
  }

  groupByCategory(list).forEach((items, category) => {
    const group = document.createElement("section");
    group.className = "rail-group";

    const heading = document.createElement("h2");
    heading.className = "rail-group-title";
    heading.textContent = category;
    group.appendChild(heading);

    const ul = document.createElement("ul");
    ul.className = "rail-items";
    items.forEach((p) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rail-item" + (p.id === selectedId ? " active" : "");
      btn.dataset.id = p.id;
      btn.textContent = p.title || "Untitled";
      if (p.id === selectedId) btn.setAttribute("aria-current", "true");
      li.appendChild(btn);
      ul.appendChild(li);
    });

    group.appendChild(ul);
    railList.appendChild(group);
  });
}

/* Rail rows are real buttons, so Enter/Space and focus come for free;
   the arrow keys are added on top so the rail behaves like a list. */
railList.addEventListener("click", (e) => {
  const btn = e.target.closest ? e.target.closest(".rail-item") : null;
  if (btn) selectProgram(btn.dataset.id);
});

railList.addEventListener("keydown", (e) => {
  const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
  if (keys.indexOf(e.key) === -1) return;
  const items = Array.prototype.slice.call(railList.querySelectorAll(".rail-item"));
  const at = items.indexOf(e.target);
  if (at === -1) return;
  e.preventDefault();
  const next =
    e.key === "Home"
      ? 0
      : e.key === "End"
      ? items.length - 1
      : e.key === "ArrowDown"
      ? Math.min(items.length - 1, at + 1)
      : Math.max(0, at - 1);
  items[next].focus();
});

function writeHash(program) {
  if (typeof history === "undefined" || !history.replaceState) return;
  const slug = slugify(program.title);
  if (!slug) return;
  try {
    history.replaceState(null, "", "#" + slug);
  } catch (_) {
    /* opened straight from the filesystem — a shareable link isn't possible */
  }
}

function selectProgram(id, opts) {
  const program = programById(id);
  if (!program) return;
  selectedId = id;
  currentCode = program.code || "";
  editing = false;
  if (!(opts && opts.keepHash)) writeHash(program);
  renderRail();
  renderWorkspace();
  closeRail();
}

/* ---------- The workspace ---------- */
function renderWorkspace() {
  const program = programById(selectedId);

  if (!program) {
    workspace.innerHTML =
      '<p class="workspace-note">' +
      (allPrograms.length
        ? "Pick a program from the list to read and run it."
        : 'No programs yet. Add the first one from the <a href="admin.html">Admin Panel</a>.') +
      "</p>";
    return;
  }

  const original = program.code || "";

  workspace.innerHTML = `
    <div class="workspace-head">
      <h2>${escapeHtml(program.title || "Untitled")}</h2>
      ${program.description ? `<p>${escapeHtml(program.description)}</p>` : ""}
    </div>

    <div class="code-window">
      <div class="window-bar">
        <span class="window-file">${escapeHtml(fileNameFor(program))}</span>
        <div class="window-actions">
          <button type="button" class="win-btn win-run">Run<kbd aria-hidden="true">${MODKEY} &#9166;</kbd></button>
          <button type="button" class="win-btn win-copy">Copy</button>
          <button type="button" class="win-btn win-edit">Edit</button>
          <button type="button" class="win-btn win-reset" hidden>Reset</button>
        </div>
      </div>
      <div class="code-host"></div>
      <div class="window-images" hidden></div>
      <div class="window-out" hidden>
        <div class="out-bar">
          <span class="out-label">Output</span>
          <span class="out-time"></span>
        </div>
        <pre class="out-body" role="log" aria-live="polite" aria-atomic="false"></pre>
      </div>
    </div>`;

  const host = workspace.querySelector(".code-host");
  const runBtn = workspace.querySelector(".win-run");
  const copyBtn = workspace.querySelector(".win-copy");
  const editBtn = workspace.querySelector(".win-edit");
  const resetBtn = workspace.querySelector(".win-reset");
  const panel = {
    box: workspace.querySelector(".window-out"),
    body: workspace.querySelector(".out-body"),
    time: workspace.querySelector(".out-time"),
    images: workspace.querySelector(".window-images"),
  };

  /* Reset stays reachable for as long as the code differs from what was
     published — saving an edit no longer strands the original. */
  function syncActions() {
    resetBtn.hidden = currentCode === original;
    editBtn.textContent = editing ? "Done" : "Edit";
    runBtn.disabled = running;
  }

  function gutterFor(code) {
    const lines = code.split("\n").length;
    const numbers = [];
    for (let i = 1; i <= lines; i++) numbers.push(i);
    return numbers.join("\n");
  }

  function showCode() {
    host.innerHTML =
      '<div class="code-body">' +
      '<div class="code-gutter" aria-hidden="true"></div>' +
      '<pre class="code-view" tabindex="0" role="region"><code class="language-python"></code></pre>' +
      "</div>";
    host.querySelector(".code-gutter").textContent = gutterFor(currentCode);
    host.querySelector(".code-view").setAttribute(
      "aria-label",
      (program.title || "Program") + " source, scrollable"
    );
    const codeEl = host.querySelector("code");
    codeEl.textContent = currentCode;
    if (typeof Prism !== "undefined" && Prism.highlightElement) Prism.highlightElement(codeEl);
    syncActions();
  }

  function showEditor() {
    host.innerHTML =
      '<div class="code-body editing">' +
      '<div class="code-gutter" aria-hidden="true"></div>' +
      '<textarea class="code-editor" spellcheck="false" wrap="off"></textarea>' +
      "</div>";
    const gutter = host.querySelector(".code-gutter");
    const area = host.querySelector("textarea");
    area.value = currentCode;
    area.setAttribute("aria-label", "Edit " + fileNameFor(program));

    function sync() {
      currentCode = area.value;
      area.rows = Math.max(8, area.value.split("\n").length);
      gutter.textContent = gutterFor(area.value);
      syncActions();
    }
    sync();
    area.addEventListener("input", sync);
    attachEditorKeys(area, sync);
    area.focus();
  }

  editBtn.addEventListener("click", () => {
    editing = !editing;
    if (editing) showEditor();
    else showCode();
  });

  resetBtn.addEventListener("click", () => {
    currentCode = original;
    if (editing) showEditor();
    else showCode();
  });

  copyBtn.addEventListener("click", () => copyCode(copyBtn));

  runBtn.addEventListener("click", () => {
    runProgram(currentCode, panel, syncActions);
  });

  if (editing) showEditor();
  else showCode();
}

/* ---------- Editing: Tab indents, Enter keeps the block ----------
   Insertions go through execCommand where it exists so the browser's own
   undo history survives; splicing .value directly would wipe it. */
function insertAtCaret(area, text) {
  if (typeof document.execCommand === "function") {
    try {
      if (document.execCommand("insertText", false, text)) return;
    } catch (_) {
      /* fall through to the manual path */
    }
  }
  const start = area.selectionStart;
  const end = area.selectionEnd;
  area.value = area.value.slice(0, start) + text + area.value.slice(end);
  const caret = start + text.length;
  if (area.setSelectionRange) area.setSelectionRange(caret, caret);
}

function attachEditorKeys(area, onChange) {
  area.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const value = area.value;
      const start = area.selectionStart;
      const end = area.selectionEnd;
      const spansLines = value.slice(start, end).indexOf("\n") !== -1;

      // A plain Tab with no multi-line selection just adds one level.
      if (!spansLines && !e.shiftKey) {
        insertAtCaret(area, "    ");
        onChange();
        return;
      }

      // Otherwise shift every touched line in or out by one level.
      const from = value.lastIndexOf("\n", start - 1) + 1;
      const lineEnd = value.indexOf("\n", end);
      const to = lineEnd === -1 ? value.length : lineEnd;
      const lines = value.slice(from, to).split("\n");
      const shifted = e.shiftKey
        ? lines.map((line) => line.replace(/^ {1,4}/, "")).join("\n")
        : lines.map((line) => "    " + line).join("\n");

      area.setSelectionRange(from, to);
      insertAtCaret(area, shifted);
      area.setSelectionRange(from, from + shifted.length);
      onChange();
      return;
    }

    if (e.key === "Enter") {
      const value = area.value;
      const start = area.selectionStart;
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const line = value.slice(lineStart, start);
      const indent = (line.match(/^[ \t]*/) || [""])[0];
      const deeper = /:\s*$/.test(line) ? "    " : "";
      if (!indent && !deeper) return; // nothing to carry over, let the browser do it
      e.preventDefault();
      insertAtCaret(area, "\n" + indent + deeper);
      onChange();
    }
  });
}

/* ---------- Copy, and the keyboard shortcuts ---------- */
function fallbackCopy(text, done) {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  document.body.appendChild(area);
  if (area.select) area.select();
  try {
    document.execCommand("copy");
  } catch (_) {
    /* nothing else to try */
  }
  area.remove();
  done();
}

function copyCode(btn) {
  const text = currentCode;
  const done = () => {
    btn.textContent = "Copied";
    btn.classList.add("done");
    setTimeout(() => {
      btn.textContent = "Copy";
      btn.classList.remove("done");
    }, 1400);
  };
  if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function triggerRun() {
  const btn = workspace.querySelector(".win-run");
  if (btn && !btn.disabled) btn.click();
}

/* Bound once on the document, so Ctrl/Cmd+Enter runs whether the caret is in
   the editor or the focus is anywhere else on the page. */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeRail();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    triggerRun();
    return;
  }
  const tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : "";
  if (e.key === "/" && tag !== "input" && tag !== "textarea" && tag !== "select") {
    e.preventDefault();
    searchInput.focus();
  }
});

searchInput.addEventListener("input", renderRail);

/* ============================================
   Python engine (Pyodide) — behaviour unchanged
   ============================================ */

let pyodideInstance = null;
let pyodideLoading = null;

function ensurePyodide(onStatus) {
  if (pyodideInstance) return Promise.resolve(pyodideInstance);
  if (pyodideLoading) return pyodideLoading;
  if (onStatus) onStatus("Starting Python. This happens once, then runs are instant.");
  pyodideLoading = loadPyodide().then(async (py) => {
    await py.loadPackage(["micropip"]);
    pyodideInstance = py;
    return py;
  });
  return pyodideLoading;
}

/* Pull the literal prompt out of input("...") calls, in source order. Falls
   back to a generic label when the prompt isn't a plain string literal. */
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

/* One inline field, appended right where the prompt printed. Resolves with the
   typed value on Enter. Styled to sit in the terminal, not look like a form. */
function collectInlineInput(outputEl) {
  return new Promise((resolve) => {
    const field = document.createElement("input");
    field.type = "text";
    field.className = "stdin-inline";
    field.autocomplete = "off";
    field.spellcheck = false;
    field.size = 1;
    field.setAttribute("aria-label", "Program input, press Enter to send");
    outputEl.appendChild(field);
    field.focus();
    outputEl.scrollTop = outputEl.scrollHeight;

    field.addEventListener("input", () => {
      field.size = Math.max(1, field.value.length);
    });
    field.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const value = field.value;
      field.remove();
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
    return "This package isn't preloaded, so the runner tried to install it. If it still fails, it may not be available for Pyodide.";
  }
  if (/RecursionError/.test(message)) {
    return "The function calls itself too many times without stopping. Check the base case.";
  }
  if (/IndentationError|unexpected indent/.test(message)) {
    return "Python counts spaces. Every line in the same block needs the same indent — Tab in the editor adds four spaces.";
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

/* ---------- Run ---------- */
function now() {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}

function elapsed(from) {
  const ms = now() - from;
  return ms < 950 ? Math.round(ms) + " ms" : (ms / 1000).toFixed(1) + " s";
}

async function runProgram(code, panel, syncActions) {
  const box = panel.box;
  const body = panel.body;
  const time = panel.time;
  const images = panel.images;

  running = true;
  if (syncActions) syncActions();

  box.hidden = false;
  body.textContent = "";
  time.textContent = "";
  images.hidden = true;
  images.innerHTML = "";

  let started = 0;

  try {
    const py = await ensurePyodide((msg) => {
      body.textContent = msg;
    });
    body.textContent = "";

    // Every input() value is collected up front, one field at a time, inline in
    // the terminal and in source order — so snippets with two or more input()
    // calls get the right value in each.
    const prompts = extractInputPrompts(code);
    const values = [];
    for (const label of prompts) {
      body.textContent += label;
      values.push(await collectInlineInput(body));
      body.textContent += values[values.length - 1] + "\n";
    }

    // The clock starts after the typing, so it times the program, not the typist.
    started = now();

    const queue = values.slice();
    let output = "";
    py.setStdout({ batched: (s) => (output += s + "\n") });
    py.setStderr({ batched: (s) => (output += s + "\n") });
    py.setStdin({ stdin: () => (queue.length ? queue.shift() : "") + "\n" });

    // Fresh globals per run so one program's variables and imports can't leak
    // into the next one.
    const freshGlobals = py.globals.get("dict")();

    try {
      await py.runPythonAsync(MPL_SETUP, { globals: freshGlobals });
    } catch (_) {
      /* matplotlib isn't installed — most programs don't need it */
    }

    async function execute() {
      await py.runPythonAsync(code, { globals: freshGlobals });
    }

    try {
      await execute();
    } catch (err) {
      const missing = extractMissingModule(err.message);
      if (!missing) throw err;
      body.textContent += 'Installing "' + missing + '"…\n';
      try {
        const micropip = py.pyimport("micropip");
        await micropip.install(missing);
        output = "";
        queue.length = 0;
        values.forEach((v) => queue.push(v));
        await execute();
      } catch (_) {
        throw err;
      }
    }

    const figures = await captureFigures(py);
    if (figures && figures.length) {
      images.hidden = false;
      figures.forEach((b64) => {
        const img = document.createElement("img");
        img.src = "data:image/png;base64," + b64;
        img.className = "snippet-plot";
        img.alt = "Figure drawn by this program";
        images.appendChild(img);
      });
    }

    freshGlobals.destroy();

    // input() echoes its own prompt to stdout when it really runs, and we
    // already printed that during collection — drop the duplicate.
    prompts.forEach((label) => {
      const idx = output.indexOf(label);
      if (idx !== -1) output = output.slice(0, idx) + output.slice(idx + label.length);
    });

    body.textContent += output.trim() || "(no output)";
    time.textContent = "finished in " + elapsed(started);
  } catch (err) {
    const raw = err && err.message ? err.message : String(err);
    const line = document.createElement("span");
    line.className = "out-error";
    line.textContent = (body.textContent ? "\n" : "") + cleanTraceback(raw);
    body.appendChild(line);
    const hint = friendlyHint(raw);
    if (hint) {
      const tip = document.createElement("span");
      tip.className = "out-hint";
      tip.textContent = hint;
      body.appendChild(tip);
    }
    time.textContent = started ? "stopped after " + elapsed(started) : "stopped";
  } finally {
    running = false;
    if (syncActions) syncActions();
  }
}

/* ---------- Load programs live from Firestore ---------- */
function initialSelection() {
  const hash = typeof location !== "undefined" ? (location.hash || "").replace(/^#/, "") : "";
  if (hash) {
    const linked = allPrograms.find((p) => slugify(p.title) === hash);
    if (linked) return linked.id;
  }
  const first = visiblePrograms()[0] || allPrograms[0];
  return first ? first.id : null;
}

function sameProgram(a, b) {
  if (!a || !b) return false;
  return (
    a.title === b.title &&
    a.description === b.description &&
    a.category === b.category &&
    a.code === b.code
  );
}

function applyPrograms(docs) {
  const previousId = selectedId;
  const previousCode = currentCode;
  const previous = programById(previousId);
  // Compare against the code as published *before* this snapshot landed, so a
  // half-finished edit is recognised and kept.
  const dirty = previousId != null && previousCode !== originalCodeOf(previousId);

  allPrograms = docs;

  const stillThere = programById(previousId);
  if (previousId != null && stillThere) {
    selectedId = previousId;
    currentCode = dirty ? previousCode : originalCodeOf(previousId);
    renderRail();
    // Someone else editing a different program shouldn't wipe this pane —
    // output, edit mode and caret all survive.
    if (!sameProgram(previous, stillThere)) renderWorkspace();
    return;
  }

  editing = false;
  selectedId = initialSelection();
  currentCode = selectedId ? originalCodeOf(selectedId) : "";
  renderRail();
  renderWorkspace();
}

db.collection("pythonPrograms")
  .orderBy("order", "desc")
  .onSnapshot(
    (snapshot) => applyPrograms(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))),
    (err) => {
      railCount.textContent = "";
      railList.innerHTML = "";
      workspace.innerHTML =
        '<p class="workspace-note">Could not load programs (' + escapeHtml(err.message) + ").</p>";
    }
  );

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    const hash = (location.hash || "").replace(/^#/, "");
    if (!hash) return;
    const linked = allPrograms.find((p) => slugify(p.title) === hash);
    if (linked && linked.id !== selectedId) selectProgram(linked.id, { keepHash: true });
  });
}

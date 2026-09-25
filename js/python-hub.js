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
const blankEditorBtn = document.getElementById("blankEditorBtn");
const programRail = document.getElementById("programRail");
const overlay = document.getElementById("overlay");
const railList = document.getElementById("rail-list");
const railCount = document.getElementById("rail-count");
const searchInput = document.getElementById("search-input");
const workspace = document.getElementById("workspace");

/* ---------- State ---------- */
const BLANK_CODE_DEFAULT =
  "# Write or paste your Python code here and click Run\n\n" +
  "print(\"Hello from Python Hub!\")\n";
let blankCode = BLANK_CODE_DEFAULT;
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
  if (program && program.isCustomBlank) return "scratchpad.py";
  const base = slugify(program && program.title).replace(/-/g, "_");
  return (base || "program") + ".py";
}

function programById(id) {
  if (id === "__blank__") {
    return {
      id: "__blank__",
      title: "Blank Editor",
      description: "Write, edit, and run your own custom Python code directly in your browser.",
      code: blankCode,
      isCustomBlank: true
    };
  }
  return allPrograms.find((p) => p.id === id) || null;
}

function originalCodeOf(id, list) {
  if (id === "__blank__") return BLANK_CODE_DEFAULT;
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

function updateBlankBtnState() {
  if (!blankEditorBtn) return;
  const isBlank = selectedId === "__blank__";
  blankEditorBtn.classList.toggle("active", isBlank);
  blankEditorBtn.setAttribute("aria-pressed", isBlank ? "true" : "false");
}

function selectBlankEditor(opts) {
  selectedId = "__blank__";
  currentCode = blankCode;
  editing = true;
  if (!(opts && opts.keepHash)) {
    try {
      history.replaceState(null, "", "#blank-editor");
    } catch (_) {}
  }
  updateBlankBtnState();
  renderRail();
  renderWorkspace();
  closeRail();
}

if (blankEditorBtn) {
  blankEditorBtn.addEventListener("click", () => selectBlankEditor());
}

function selectProgram(id, opts) {
  const program = programById(id);
  if (!program) return;
  selectedId = id;
  currentCode = program.code || "";
  editing = false;
  if (!(opts && opts.keepHash)) writeHash(program);
  updateBlankBtnState();
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
    if (program.isCustomBlank) {
      resetBtn.textContent = "Clear";
      resetBtn.hidden = !currentCode.trim();
    } else {
      resetBtn.textContent = "Reset";
      resetBtn.hidden = currentCode === original;
    }
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
      '<div class="code-editor-wrap">' +
      '<pre class="code-highlight-backdrop" aria-hidden="true"><code class="language-python"></code></pre>' +
      '<textarea class="code-editor" spellcheck="false" wrap="off" autocorrect="off" autocapitalize="off"></textarea>' +
      '</div>' +
      "</div>";
    const gutter    = host.querySelector(".code-gutter");
    const area      = host.querySelector("textarea");
    const backdrop  = host.querySelector(".code-highlight-backdrop");
    const codeEl    = backdrop.querySelector("code");

    area.value = currentCode;
    area.setAttribute("aria-label", "Edit " + fileNameFor(program));

    function updateHighlight() {
      // Prism needs a trailing newline so the last line is highlighted properly
      const text = area.value.endsWith("\n") ? area.value : area.value + "\n";
      codeEl.textContent = text;
      if (typeof Prism !== "undefined" && Prism.highlightElement) {
        Prism.highlightElement(codeEl);
      }
      // Keep backdrop scroll in sync with textarea
      backdrop.scrollTop  = area.scrollTop;
      backdrop.scrollLeft = area.scrollLeft;
    }

    // Sync scroll from textarea → backdrop
    area.addEventListener("scroll", () => {
      backdrop.scrollTop  = area.scrollTop;
      backdrop.scrollLeft = area.scrollLeft;
    });

    function sync() {
      currentCode = area.value;
      if (program.isCustomBlank) {
        blankCode = area.value;
      }
      area.rows = Math.max(8, area.value.split("\n").length);
      gutter.textContent = gutterFor(area.value);
      updateHighlight();
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
    if (program.isCustomBlank) {
      currentCode = "";
      blankCode = "";
    } else {
      currentCode = original;
    }
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

/* ---------- HTML5 Canvas Turtle Graphics Engine ---------- */
const TURTLE_PYTHON_MODULE = `
import math, sys

class _TurtleEngine:
    def __init__(self):
        self.commands = []
        self.width = 540
        self.height = 420
        self.bgcolor = None
        self.colormode_val = 1.0
        self.turtles = []
        self.default_turtle = None
        self.active = False

    def reset_all(self):
        self.commands = []
        self.width = 540
        self.height = 420
        self.bgcolor = None
        self.colormode_val = 1.0
        self.turtles = []
        self.default_turtle = None
        self.active = False

    def to_color_str(self, *args):
        if not args:
            return "black"
        if len(args) == 1:
            val = args[0]
            if isinstance(val, str):
                return val.strip()
            if isinstance(val, (tuple, list)):
                args = val
        if len(args) >= 3:
            r, g, b = args[0], args[1], args[2]
            if self.colormode_val == 255:
                return f"rgb({int(r)}, {int(g)}, {int(b)})"
            else:
                return f"rgb({int(r*255)}, {int(g*255)}, {int(b*255)})"
        return str(args[0]).strip()

_engine = _TurtleEngine()

class Turtle:
    def __init__(self, engine=None):
        self._engine = engine if engine else _engine
        self._engine.active = True
        self.x = 0.0
        self.y = 0.0
        self.angle = 0.0
        self._pen_down = True
        self._pen_size = 2
        self._pen_color = "black"
        self._fill_color = "black"
        self._visible = True
        self._filling = False
        self._fill_path = []
        if self not in self._engine.turtles:
            self._engine.turtles.append(self)

    def forward(self, d):
        rad = math.radians(self.angle)
        nx = self.x + d * math.cos(rad)
        ny = self.y + d * math.sin(rad)
        if self._pen_down:
            self._engine.commands.append(["line", self.x, self.y, nx, ny, self._pen_color, self._pen_size])
        if self._filling:
            self._fill_path.append([nx, ny])
        self.x = nx
        self.y = ny

    fd = forward

    def backward(self, d): self.forward(-d)
    bk = backward
    back = backward

    def right(self, a): self.angle = (self.angle - a) % 360
    rt = right

    def left(self, a): self.angle = (self.angle + a) % 360
    lt = left

    def penup(self): self._pen_down = False
    pu = penup
    up = penup

    def pendown(self): self._pen_down = True
    pd = pendown
    down = pendown

    def isdown(self): return self._pen_down

    def pensize(self, w=None):
        if w is not None: self._pen_size = max(1, float(w))
        return self._pen_size
    width = pensize

    def color(self, *args):
        if len(args) == 1:
            c = self._engine.to_color_str(args[0])
            self._pen_color = c
            self._fill_color = c
        elif len(args) >= 2:
            self._pen_color = self._engine.to_color_str(args[0])
            self._fill_color = self._engine.to_color_str(args[1])

    def pencolor(self, *args):
        if args: self._pen_color = self._engine.to_color_str(*args)
        return self._pen_color

    def fillcolor(self, *args):
        if args: self._fill_color = self._engine.to_color_str(*args)
        return self._fill_color

    def begin_fill(self):
        self._filling = True
        self._fill_path = [[self.x, self.y]]

    def end_fill(self):
        if self._filling and len(self._fill_path) > 1:
            self._engine.commands.append(["fill", list(self._fill_path), self._fill_color])
        self._filling = False
        self._fill_path = []

    def filling(self): return self._filling

    def goto(self, x, y=None):
        if y is None and isinstance(x, (tuple, list)):
            nx, ny = float(x[0]), float(x[1])
        else:
            nx, ny = float(x), float(y)
        if self._pen_down:
            self._engine.commands.append(["line", self.x, self.y, nx, ny, self._pen_color, self._pen_size])
        if self._filling:
            self._fill_path.append([nx, ny])
        self.x = nx
        self.y = ny
    setpos = goto
    setposition = goto

    def setx(self, x): self.goto(x, self.y)
    def sety(self, y): self.goto(self.x, y)
    def setheading(self, a): self.angle = float(a) % 360
    seth = setheading
    def home(self):
        self.goto(0, 0)
        self.setheading(0)

    def circle(self, radius, extent=360, steps=None):
        if steps is None:
            steps = max(18, int(abs(radius) * 3.14159 / 5))
            steps = min(steps, 72)
        steps = max(3, steps)
        frac = extent / 360.0
        n = max(1, int(round(steps * abs(frac))))
        step_angle = extent / n
        step_dist = 2.0 * radius * math.sin(math.radians(step_angle / 2.0))
        self.left(step_angle / 2.0)
        for _ in range(n):
            self.forward(step_dist)
            self.left(step_angle)
        self.right(step_angle / 2.0)

    def dot(self, size=None, *color):
        s = float(size) if size is not None else max(self._pen_size + 4, 2 * self._pen_size)
        c = self._engine.to_color_str(*color) if color else self._pen_color
        self._engine.commands.append(["dot", self.x, self.y, s, c])

    def write(self, arg, move=False, align="left", font=("Arial", 11, "normal")):
        text = str(arg)
        size = 11; family = "Arial"; style = "normal"
        if isinstance(font, (tuple, list)):
            if len(font) > 0: family = font[0]
            if len(font) > 1: size = font[1]
            if len(font) > 2: style = font[2]
        font_str = f"{style} {size}px {family}"
        self._engine.commands.append(["write", text, self.x, self.y, str(align).lower(), font_str, self._pen_color])

    def stamp(self):
        self._engine.commands.append(["stamp", self.x, self.y, self.angle, self._pen_color])

    def speed(self, *a): pass
    def shape(self, s=None): return "classic"
    def hideturtle(self): self._visible = False
    ht = hideturtle
    def showturtle(self): self._visible = True
    st = showturtle
    def isvisible(self): return self._visible
    def pos(self): return (self.x, self.y)
    position = pos
    def xcor(self): return self.x
    def ycor(self): return self.y
    def heading(self): return self.angle
    def distance(self, x, y=None):
        if y is None and isinstance(x, (tuple, list)): tx, ty = x[0], x[1]
        else: tx, ty = float(x), float(y)
        return math.hypot(self.x - tx, self.y - ty)

def _get_default():
    if _engine.default_turtle is None:
        _engine.default_turtle = Turtle(_engine)
    _engine.active = True
    return _engine.default_turtle

def forward(d): _get_default().forward(d)
fd = forward
def backward(d): _get_default().backward(d)
bk = backward
back = backward
def right(a): _get_default().right(a)
rt = right
def left(a): _get_default().left(a)
lt = left
def penup(): _get_default().penup()
pu = penup
up = penup
def pendown(): _get_default().pendown()
pd = pendown
down = pendown
def isdown(): return _get_default().isdown()
def pensize(w=None): return _get_default().pensize(w)
width = pensize
def color(*a): _get_default().color(*a)
def pencolor(*a): return _get_default().pencolor(*a)
def fillcolor(*a): return _get_default().fillcolor(*a)
def begin_fill(): _get_default().begin_fill()
def end_fill(): _get_default().end_fill()
def filling(): return _get_default().filling()
def goto(x, y=None): _get_default().goto(x, y)
setpos = goto
setposition = goto
def setx(x): _get_default().setx(x)
def sety(y): _get_default().sety(y)
def setheading(a): _get_default().setheading(a)
seth = setheading
def home(): _get_default().home()
def circle(r, ext=360, steps=None): _get_default().circle(r, ext, steps)
def dot(s=None, *c): _get_default().dot(s, *c)
def write(arg, move=False, align="left", font=("Arial", 11, "normal")): _get_default().write(arg, move, align, font)
def stamp(): return _get_default().stamp()
def speed(*a): pass
def shape(s=None): return _get_default().shape(s)
def hideturtle(): _get_default().hideturtle()
ht = hideturtle
def showturtle(): _get_default().showturtle()
st = showturtle
def isvisible(): return _get_default().isvisible()
def pos(): return _get_default().pos()
position = pos
def xcor(): return _get_default().xcor()
def ycor(): return _get_default().ycor()
def heading(): return _get_default().heading()
def distance(*a): return _get_default().distance(*a)
def towards(*a): return _get_default().towards(*a)

def bgcolor(*args):
    _engine.active = True
    if args:
        _engine.bgcolor = _engine.to_color_str(*args)
        _engine.commands.append(["bgcolor", _engine.bgcolor])
    return _engine.bgcolor

def screensize(canvwidth=None, canvheight=None, bg=None):
    _engine.active = True
    if canvwidth: _engine.width = int(canvwidth)
    if canvheight: _engine.height = int(canvheight)
    if bg: bgcolor(bg)
    return (_engine.width, _engine.height)

def setup(width=None, height=None, *a):
    _engine.active = True
    if width: _engine.width = int(width) if width > 1 else int(540 * width)
    if height: _engine.height = int(height) if height > 1 else int(420 * height)

def colormode(cmode=None):
    if cmode in (1.0, 255): _engine.colormode_val = cmode
    return _engine.colormode_val

def title(t): pass
def done(): pass
def mainloop(): pass
bye = done
exitonclick = done
def clearscreen(): _engine.reset_all()
clear = clearscreen
reset = clearscreen
def Screen():
    _engine.active = True
    return sys.modules[__name__]
getscreen = Screen

def _export_render():
    if not _engine.active and not _engine.commands:
        return None
    turtles_data = []
    for t in _engine.turtles:
        if t.isvisible():
            turtles_data.append([t.x, t.y, t.angle, t._pen_color])
    return {
        "active": _engine.active,
        "width": _engine.width,
        "height": _engine.height,
        "bgcolor": _engine.bgcolor,
        "commands": _engine.commands,
        "turtles": turtles_data
    }

def _reset(): _engine.reset_all()
`;

function ensurePyodide(onStatus) {
  if (pyodideInstance) return Promise.resolve(pyodideInstance);
  if (pyodideLoading) return pyodideLoading;
  if (onStatus) onStatus("Starting Python. This happens once, then runs are instant.");
  pyodideLoading = loadPyodide().then(async (py) => {
    await py.loadPackage(["micropip"]);
    try {
      const pyMinor = py.runPython("import sys; sys.version_info.minor");
      py.FS.writeFile(`/lib/python3.${pyMinor}/turtle.py`, TURTLE_PYTHON_MODULE);
    } catch (e) {
      console.warn("Could not write turtle module:", e);
    }
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
  if (!message) return null;
  const m1 = message.match(/The module ['"]([\w.]+)['"] is included in the Pyodide distribution/i);
  if (m1) return m1[1].split(".")[0];
  const m2 = message.match(/No module named ['"]([\w.]+)['"]/i);
  if (m2) return m2[1].split(".")[0];
  const m3 = message.match(/cannot import name ['"][\w.]+['"] from ['"]([\w.]+)['"]/i);
  if (m3) return m3[1].split(".")[0];
  return null;
}

/* ---------- matplotlib support: capture any open or shown figures as images ---------- */
const MPL_SETUP = `
try:
    import matplotlib
    matplotlib.use("AGG")
    import matplotlib.pyplot as _plt
    import io as _io, base64 as _base64
    if not hasattr(_plt, "_captured_figures"):
        _plt._captured_figures = []
    def _hub_show(*args, **kwargs):
        for _num in _plt.get_fignums():
            _fig = _plt.figure(_num)
            _buf = _io.BytesIO()
            _fig.savefig(_buf, format="png", bbox_inches="tight")
            _plt._captured_figures.append(_base64.b64encode(_buf.getvalue()).decode("ascii"))
        _plt.close("all")
    _plt.show = _hub_show
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
    if hasattr(_plt, "_captured_figures"):
        _out.extend(_plt._captured_figures)
        _plt._captured_figures = []
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

function drawTurtlePointer(ctx, cx, cy, angleDeg, color) {
  const cleanColor = String(color || "").trim() || "#10b981";
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-angleDeg * Math.PI) / 180);
  ctx.beginPath();
  // Classic turtle pointer arrow
  ctx.moveTo(11, 0);
  ctx.lineTo(-7, -7);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-7, 7);
  ctx.closePath();
  ctx.fillStyle = cleanColor;
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

function renderTurtleCanvas(data) {
  if (!data || (!data.active && (!data.commands || !data.commands.length))) {
    return null;
  }
  if ((!data.commands || !data.commands.length) && (!data.turtles || !data.turtles.length)) {
    return null;
  }

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const defaultBg = isDark ? "#0f172a" : "#ffffff";
  const bg = data.bgcolor ? String(data.bgcolor).trim() : defaultBg;

  const w = Math.min(720, Math.max(360, data.width || 540));
  const h = Math.min(540, Math.max(280, data.height || 420));
  const cx = w / 2;
  const cy = h / 2;

  // Auto-fit bounding box: calculate min/max coordinates of all drawn elements & turtle cursors
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  function addPoint(x, y) {
    if (typeof x !== "number" || typeof y !== "number") return;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  if (Array.isArray(data.commands)) {
    for (const cmd of data.commands) {
      if (cmd[0] === "line") {
        addPoint(cmd[1], cmd[2]);
        addPoint(cmd[3], cmd[4]);
      } else if (cmd[0] === "fill" && Array.isArray(cmd[1])) {
        for (const pt of cmd[1]) addPoint(pt[0], pt[1]);
      } else if (cmd[0] === "dot" || cmd[0] === "write" || cmd[0] === "stamp") {
        addPoint(cmd[1], cmd[2]);
      }
    }
  }
  if (Array.isArray(data.turtles)) {
    for (const t of data.turtles) {
      addPoint(t[0], t[1]);
    }
  }

  const pad = 36;
  const availW = w - pad * 2;
  const availH = h - pad * 2;
  const halfW = availW / 2;
  const halfH = availH / 2;

  let scale = 1;
  let midX = 0;
  let midY = 0;

  // If the drawing extends beyond standard centered bounds, center and scale it
  const fitsDefault = minX >= -halfW && maxX <= halfW && minY >= -halfH && maxY <= halfH;
  if (!fitsDefault) {
    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    scale = Math.min(1, availW / spanX, availH / spanY);
    midX = (minX + maxX) / 2;
    midY = (minY + maxY) / 2;
  }

  const toX = (x) => cx + (x - midX) * scale;
  const toY = (y) => cy - (y - midY) * scale;

  const canvas = document.createElement("canvas");
  const dpr = typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = "100%";
  canvas.style.maxWidth = w + "px";
  canvas.style.height = "auto";
  canvas.style.aspectRatio = `${w}/${h}`;
  canvas.style.display = "block";
  canvas.style.margin = "12px auto";
  canvas.style.borderRadius = "8px";
  canvas.style.border = "1px solid var(--py-edge, #24314f)";
  canvas.style.background = bg;
  canvas.className = "snippet-turtle-canvas";

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  if (Array.isArray(data.commands)) {
    for (const cmd of data.commands) {
      const type = cmd[0];
      if (type === "bgcolor") {
        ctx.fillStyle = String(cmd[1] || "").trim();
        ctx.fillRect(0, 0, w, h);
      } else if (type === "line") {
        const [_, x1, y1, x2, y2, color, size] = cmd;
        let lineCol = String(color || "").trim();
        // In dark mode with dark canvas, flip default black line to light so it is clearly visible
        if (isDark && !data.bgcolor && (lineCol === "black" || lineCol === "#000000")) {
          lineCol = "#e2e8f0";
        }
        ctx.beginPath();
        ctx.strokeStyle = lineCol;
        ctx.lineWidth = Math.max(1, (size || 2) * scale);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(toX(x1), toY(y1));
        ctx.lineTo(toX(x2), toY(y2));
        ctx.stroke();
      } else if (type === "fill") {
        const [_, points, color] = cmd;
        if (points && points.length > 1) {
          ctx.beginPath();
          ctx.fillStyle = String(color || "").trim();
          ctx.moveTo(toX(points[0][0]), toY(points[0][1]));
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(toX(points[i][0]), toY(points[i][1]));
          }
          ctx.closePath();
          ctx.fill();
        }
      } else if (type === "dot") {
        const [_, x, y, size, color] = cmd;
        ctx.beginPath();
        ctx.fillStyle = String(color || "").trim();
        ctx.arc(toX(x), toY(y), (size / 2) * scale, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === "write") {
        const [_, text, x, y, align, font, color] = cmd;
        ctx.font = font;
        ctx.textAlign = align;
        ctx.fillStyle = String(color || "").trim();
        ctx.fillText(text, toX(x), toY(y));
      } else if (type === "stamp") {
        const [_, x, y, angle, color] = cmd;
        drawTurtlePointer(ctx, toX(x), toY(y), angle, color);
      }
    }
  }

  if (Array.isArray(data.turtles)) {
    for (const [tx, ty, angle, color] of data.turtles) {
      drawTurtlePointer(ctx, toX(tx), toY(ty), angle, color);
    }
  }

  return canvas;
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

    // Reset turtle canvas state before fresh run only if turtle is in sys.modules
    try {
      py.runPython(`
if "turtle" in __import__("sys").modules:
    __import__("sys").modules["turtle"]._reset()
`);
    } catch (_) {}

    // Automatically detect and load external libraries (pandas, matplotlib, numpy, scipy, etc.)
    if (typeof py.loadPackagesFromImports === "function") {
      try {
        await py.loadPackagesFromImports(code, {
          messageCallback: (msg) => {
            body.textContent = msg + "…\n";
          }
        });
      } catch (pkgErr) {
        console.warn("loadPackagesFromImports warning:", pkgErr);
      }
      body.textContent = "";
    }

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

    let attempts = 0;
    while (attempts < 5) {
      attempts++;
      try {
        await execute();
        break;
      } catch (err) {
        const missing = extractMissingModule(err && err.message ? err.message : String(err));
        if (!missing || attempts >= 5) throw err;
        body.textContent = (body.textContent ? body.textContent.trim() + "\n" : "") + 'Installing "' + missing + '"…';
        try {
          try {
            await py.loadPackage(missing);
          } catch (_) {
            const micropip = py.pyimport("micropip");
            await micropip.install(missing);
          }
          output = "";
          queue.length = 0;
          values.forEach((v) => queue.push(v));
          try {
            await py.runPythonAsync(MPL_SETUP, { globals: freshGlobals });
          } catch (_) {}
        } catch (installErr) {
          throw err;
        }
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

    // Check if turtle drew anything and render Canvas
    try {
      const hasTurtle = py.runPython(`
"turtle" in __import__("sys").modules and getattr(__import__("sys").modules["turtle"]._engine, "active", False)
`);
      if (hasTurtle) {
        const turtleDataPy = py.runPython("import turtle; turtle._export_render()");
        if (turtleDataPy) {
          const turtleData = turtleDataPy.toJs({ dict_converter: Object.fromEntries });
          const turtleCanvas = renderTurtleCanvas(turtleData);
          if (turtleCanvas) {
            images.hidden = false;
            images.appendChild(turtleCanvas);
          }
        }
      }
    } catch (tErr) {
      console.warn("Turtle render error:", tErr);
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
  if (hash === "blank-editor" || hash === "blank") return "__blank__";
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
  const dirty = previousId != null && previousCode !== originalCodeOf(previousId);

  allPrograms = docs;

  if (previousId === "__blank__") {
    selectedId = "__blank__";
    currentCode = blankCode;
    editing = true;
    updateBlankBtnState();
    renderRail();
    return;
  }

  const stillThere = programById(previousId);
  if (previousId != null && stillThere) {
    selectedId = previousId;
    currentCode = dirty ? previousCode : originalCodeOf(previousId);
    updateBlankBtnState();
    renderRail();
    // Someone else editing a different program shouldn't wipe this pane —
    // output, edit mode and caret all survive.
    if (!sameProgram(previous, stillThere)) renderWorkspace();
    return;
  }

  selectedId = initialSelection();
  if (selectedId === "__blank__") {
    currentCode = blankCode;
    editing = true;
  } else {
    editing = false;
    currentCode = selectedId ? originalCodeOf(selectedId) : "";
  }
  updateBlankBtnState();
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
    if (hash === "blank-editor" || hash === "blank") {
      if (selectedId !== "__blank__") selectBlankEditor({ keepHash: true });
      return;
    }
    const linked = allPrograms.find((p) => slugify(p.title) === hash);
    if (linked && linked.id !== selectedId) selectProgram(linked.id, { keepHash: true });
  });
}

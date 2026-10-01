/* =========================================================================
   MCQ Paper Maker Core Engine
   ========================================================================= */

const L = ["A", "B", "C", "D", "E", "F"];

// Default questions state
let qs = [
  {
    q: "Solve for $x$: $2x + 3 = 11$",
    o: ["$2$", "$3$", "$4$", "$5$"],
    a: 2,
    ol: "row",
    img: null,
    marks: 1,
    exp: "Subtract 3 from both sides: $2x = 8$, so $x = 4$."
  },
  {
    q: "The value of the definite integral $$\\int_0^1 x\\,dx$$ is",
    o: ["$0$", "$\\frac{1}{2}$", "$1$", "$2$"],
    a: 1,
    ol: "row",
    img: null,
    marks: 1,
    exp: "$\\int_0^1 x\\,dx = \\left[\\frac{x^2}{2}\\right]_0^1 = \\frac{1}{2} - 0 = \\frac{1}{2}$."
  },
  {
    q: "Which element is represented by the chemical symbol **Fe**?",
    o: ["Fluorine", "Iron", "Lead", "Zinc"],
    a: 1,
    ol: "grid",
    img: null,
    marks: 1,
    exp: "Fe comes from the Latin word *Ferrum*, meaning Iron."
  },
  {
    q: "The roots of the quadratic equation $f(x) = x^2 - 4$ are",
    o: ["$\\pm 2$", "$2$", "$-2$", "$4$"],
    a: 0,
    ol: "row",
    img: null,
    marks: 1,
    exp: "$x^2 = 4 \\implies x = \\pm 2$."
  },
  {
    q: "The formula for the volume of a sphere of radius $r$ is",
    o: ["$\\pi r^2$", "$2\\pi r$", "$\\frac{4}{3}\\pi r^3$", "$4\\pi r^2$"],
    a: 2,
    ol: "grid",
    img: null,
    marks: 1,
    exp: "Volume of a sphere is $V = \\frac{4}{3}\\pi r^3$."
  }
];

const $ = id => document.getElementById(id);
const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Toast notification helper
function showToast(msg, duration = 2400) {
  const c = $("toasts");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  c.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 250);
  }, duration);
}

// Sidebar Tab switching
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    const pane = $("tab-" + btn.dataset.tab);
    if (pane) pane.classList.add("active");
  };
});

// App Settings Getter
const S = () => ({
  inst: $("inst").value.trim(),
  title: $("title").value.trim(),
  subject: $("subject").value.trim(),
  grade: $("grade").value.trim(),
  time: $("time").value.trim(),
  marks: $("marks").value.trim(),
  instructions: $("instructions").value.trim(),
  showName: $("hdr-name").checked,
  showRoll: $("hdr-roll").checked,
  showSec: $("hdr-sec").checked,
  showDate: $("hdr-date").checked,
  size: $("size").value,
  or: $("or").value,
  margin: $("margin") ? $("margin").value : "compact",
  cols: +$("cols").value,
  copies: +$("copies").value,
  font: $("font").value,
  fs: +$("fs").value || 11,
  ol: $("ol").value,
  mode: $("mode").value,
  keyMode: $("key-mode").value,
  keyExpl: $("key-expl").checked,
  showOMR: $("show-omr").checked
});

function totalMarksCalc() {
  const sum = qs.reduce((acc, q) => acc + (Number(q.marks) || 1), 0);
  $("total-marks-label").textContent = `Total: ${sum} Mark${sum !== 1 ? 's' : ''}`;
  return sum;
}

function tileCols(s) {
  return s.copies === 4 ? 2 : s.copies === 2 ? (s.or === "l" ? 2 : 1) : 1;
}

/* =========================================================================
   Rich Text & Markdown + LaTeX Parser
   ========================================================================= */

function mj() {
  return window.MathJax && typeof MathJax.tex2svg === "function";
}

const mcache = {};
function mathSVG(tex, d) {
  const k = (d ? "d" : "i") + tex;
  if (k in mcache) return mcache[k];
  let r = "";
  try {
    const el = MathJax.tex2svg(tex, { display: !!d });
    const svg = el.querySelector("svg");
    if (svg) r = svg.outerHTML;
  } catch (e) {
    r = "";
  }
  return (mcache[k] = r);
}

function segs(t) {
  const out = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$|\\\(([\s\S]+?)\\\)/g;
  let i = 0, m;
  while ((m = re.exec(t))) {
    if (m.index > i) out.push({ t: t.slice(i, m.index) });
    out.push({ m: (m[1] ?? m[2] ?? m[3]).trim(), d: m[1] !== undefined });
    i = re.lastIndex;
  }
  if (i < t.length) out.push({ t: t.slice(i) });
  return out;
}

function formatMarkdown(str) {
  return esc(str)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/__(.*?)__/g, '<u>$1</u>')
    .replace(/~([a-zA-Z0-9+\-_=]+)~/g, '<sub>$1</sub>')
    .replace(/\^([a-zA-Z0-9+\-_=]+)\^/g, '<sup>$1</sup>')
    .replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>')
    .replace(/\n/g, '<br>');
}

function rich(t, inl) {
  return segs(t || "").map(g => {
    if (g.t !== undefined) return formatMarkdown(g.t);
    const dm = g.d && !inl;
    const v = mj() ? mathSVG(g.m, dm) : "";
    if (!v) return `<code style="color:#c00">$${esc(g.m)}$</code>`;
    return dm ? `<div class="dm">${v}</div>` : `<span class="im">${v}</span>`;
  }).join("");
}

/* =========================================================================
   Sidebar Questions List Rendering & Editing
   ========================================================================= */

let searchFilter = "";

function renderList() {
  const qcCount = qs.length;
  $("qcount").textContent = qcCount;
  totalMarksCalc();

  const filtered = qs.map((q, i) => ({ q, i })).filter(({ q }) => {
    if (!searchFilter) return true;
    const term = searchFilter.toLowerCase();
    return q.q.toLowerCase().includes(term) || q.o.some(o => (o || "").toLowerCase().includes(term));
  });

  if (!filtered.length) {
    $("list").innerHTML = qs.length
      ? '<div style="color:var(--mute);padding:16px;text-align:center">No questions match your search.</div>'
      : '<div style="color:var(--mute);padding:16px;text-align:center">No questions yet. Click "Add Question" or import questions.</div>';
    return;
  }

  const LO = [
    ["", "Layout: Paper Default"],
    ["row", "Layout: 1 × 4 Row"],
    ["grid", "Layout: 2 × 2 Grid"],
    ["col", "Layout: 4 × 1 Stacked"],
    ["auto", "Layout: Auto"]
  ];

  $("list").innerHTML = filtered.map(({ q, i }) => `
    <div class="qc" data-i="${i}" id="qc-${i}">
      <div class="qc-top">
        <div class="qc-title">
          <span style="background:var(--primary);color:#fff;width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px">${i + 1}</span>
          <span>Question ${i + 1}</span>
        </div>
        <div class="qc-actions">
          <button class="btn btn-sm" data-act="up" data-i="${i}" title="Move Up" ${i === 0 ? "disabled" : ""}>↑</button>
          <button class="btn btn-sm" data-act="down" data-i="${i}" title="Move Down" ${i === qs.length - 1 ? "disabled" : ""}>↓</button>
          <button class="btn btn-sm" data-act="dup" data-i="${i}" title="Duplicate">📋</button>
          <button class="btn btn-sm btn-danger" data-act="del" data-i="${i}" title="Delete">🗑️</button>
        </div>
      </div>
      <div class="qc-body">
        <label>Question Text (Supports LaTeX $...$ &amp; Markdown **bold**):</label>
        <textarea data-q="${i}" rows="2">${esc(q.q)}</textarea>

        <div style="margin-top:8px">
          <label>Options &amp; Correct Answer:</label>
          ${q.o.map((o, j) => `
            <div class="oi">
              <input type="radio" name="ans-${i}" data-a="${i}:${j}" ${q.a === j ? "checked" : ""} title="Mark as correct answer">
              <span class="oi-letter ${q.a === j ? "correct" : ""}">${L[j]}</span>
              <input type="text" data-o="${i}:${j}" value="${esc(o)}" placeholder="Option ${L[j]}">
              ${q.o.length > 2 ? `<button class="oi-del" data-del-opt="${i}:${j}" title="Remove option">✕</button>` : ""}
            </div>
          `).join("")}
          ${q.o.length < 6 ? `
            <button class="btn btn-sm" data-add-opt="${i}" style="margin-top:6px">+ Add Option ${L[q.o.length] || ""}</button>
          ` : ""}
        </div>

        <div class="qc-footer">
          <div style="display:flex;gap:6px;align-items:center">
            <span style="color:var(--mute)">Layout:</span>
            <select data-ol="${i}" style="width:auto;padding:3px 6px">
              ${LO.map(([v, t]) => `<option value="${v}" ${(q.ol || "") === v ? "selected" : ""}>${t}</option>`).join("")}
            </select>
            <span style="color:var(--mute);margin-left:4px">Marks:</span>
            <input type="number" data-marks="${i}" value="${q.marks || 1}" min="0.5" step="0.5" style="width:52px;padding:3px 6px">
          </div>

          <div style="display:flex;gap:4px">
            <label class="btn btn-sm">📷 Image<input type="file" accept="image/*" data-img="${i}" hidden></label>
            <button class="btn btn-sm" data-plot="${i}">📈 Plot</button>
          </div>
        </div>

        ${q.img ? `
          <div class="qc-img-preview">
            <img src="${q.img.src}" alt="Question Image">
            <div style="flex:1">
              <div style="font-size:11px;color:var(--mute);margin-bottom:2px">Width: <span id="wlabel-${i}">${q.img.wmm}</span> mm</div>
              <input type="range" min="20" max="150" value="${q.img.wmm}" data-w="${i}">
            </div>
            <button class="btn btn-sm btn-danger" data-rm-img="${i}">Remove</button>
          </div>
        ` : ""}

        <details style="margin-top:8px">
          <summary style="font-size:11.5px;color:var(--mute);cursor:pointer">Add Explanation / Solution (Optional)</summary>
          <textarea data-exp="${i}" rows="1" placeholder="Explanation for answer key..." style="margin-top:4px">${esc(q.exp || "")}</textarea>
        </details>
      </div>
    </div>
  `).join("");
}

// Search filter listener
$("qsearch").addEventListener("input", e => {
  searchFilter = e.target.value.trim();
  renderList();
});

// Expand/Collapse All
let allCollapsed = false;
$("btn-expand-all").onclick = () => {
  allCollapsed = !allCollapsed;
  document.querySelectorAll(".qc").forEach(el => {
    el.classList.toggle("collapsed", allCollapsed);
  });
};

// Delegated inputs inside questions list
$("list").addEventListener("input", e => {
  const d = e.target.dataset;
  if (d.q !== undefined) qs[d.q].q = e.target.value;
  if (d.o) {
    const [i, j] = d.o.split(":");
    qs[i].o[j] = e.target.value;
  }
  if (d.a) {
    const [i, j] = d.a.split(":");
    qs[i].a = +j;
  }
  if (d.w !== undefined) {
    qs[d.w].img.wmm = +e.target.value;
    const lbl = $("wlabel-" + d.w);
    if (lbl) lbl.textContent = e.target.value;
  }
  if (d.ol !== undefined) qs[d.ol].ol = e.target.value;
  if (d.marks !== undefined) {
    qs[d.marks].marks = +e.target.value || 1;
    totalMarksCalc();
  }
  if (d.exp !== undefined) qs[d.exp].exp = e.target.value;
  debouncedPreview();
});

$("list").addEventListener("change", e => {
  const d = e.target.dataset;
  if (d.a) {
    const [i, j] = d.a.split(":");
    qs[i].a = +j;
    renderList();
    debouncedPreview();
  }
  if (d.img !== undefined && e.target.files[0]) {
    setImg(+d.img, e.target.files[0]);
  }
});

// Click handlers for question card buttons
$("list").addEventListener("click", e => {
  const t = e.target.closest("button");
  if (!t) return;
  const d = t.dataset;

  if (d.act === "del") {
    qs.splice(+d.i, 1);
    renderList();
    debouncedPreview();
    showToast("Question deleted");
  } else if (d.act === "dup") {
    const orig = qs[+d.i];
    const clone = JSON.parse(JSON.stringify(orig));
    qs.splice(+d.i + 1, 0, clone);
    renderList();
    debouncedPreview();
    showToast("Question duplicated");
  } else if (d.act === "up" && +d.i > 0) {
    const i = +d.i;
    [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]];
    renderList();
    debouncedPreview();
  } else if (d.act === "down" && +d.i < qs.length - 1) {
    const i = +d.i;
    [qs[i + 1], qs[i]] = [qs[i], qs[i + 1]];
    renderList();
    debouncedPreview();
  } else if (d.addOpt !== undefined) {
    const i = +d.addOpt;
    if (qs[i].o.length < 6) {
      qs[i].o.push("");
      renderList();
      debouncedPreview();
    }
  } else if (d.delOpt !== undefined) {
    const [i, j] = d.delOpt.split(":").map(Number);
    if (qs[i].o.length > 2) {
      qs[i].o.splice(j, 1);
      if (qs[i].a >= qs[i].o.length) qs[i].a = qs[i].o.length - 1;
      renderList();
      debouncedPreview();
    }
  } else if (d.rmImg !== undefined) {
    qs[+d.rmImg].img = null;
    renderList();
    debouncedPreview();
  } else if (d.plot !== undefined) {
    plotQ = +d.plot;
    $("pd").showModal();
    drawPlot();
  }
});

// Add new question
$("add").onclick = () => {
  qs.push({
    q: "",
    o: ["", "", "", ""],
    a: 0,
    ol: "",
    img: null,
    marks: 1,
    exp: ""
  });
  renderList();
  debouncedPreview();
  // Scroll to new question in list
  setTimeout(() => {
    const last = document.getElementById("qc-" + (qs.length - 1));
    if (last) last.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 50);
};

// Clear all questions
$("clr").onclick = () => {
  if (confirm("Are you sure you want to delete all questions?")) {
    qs = [];
    renderList();
    debouncedPreview();
    showToast("All questions cleared");
  }
};

// Shuffling
const shuffleArray = arr => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

$("shq").onclick = () => {
  if (!qs.length) return;
  shuffleArray(qs);
  renderList();
  debouncedPreview();
  showToast("Questions shuffled");
};

$("sho").onclick = () => {
  if (!qs.length) return;
  qs.forEach(q => {
    const correctVal = q.o[q.a];
    shuffleArray(q.o);
    q.a = Math.max(0, q.o.indexOf(correctVal));
  });
  renderList();
  debouncedPreview();
  showToast("Options shuffled for all questions");
};

// Image Upload Helper
function setImg(i, file) {
  const r = new FileReader();
  r.onload = () => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(im.naturalWidth * k);
      c.height = Math.round(im.naturalHeight * k);
      const g = c.getContext("2d");
      g.fillStyle = "#fff";
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(im, 0, 0, c.width, c.height);
      qs[i].img = {
        src: c.toDataURL("image/png"),
        wmm: Math.max(30, Math.min(90, Math.round(im.naturalWidth * 25.4 / 96))),
        nw: c.width,
        nh: c.height
      };
      renderList();
      debouncedPreview();
      showToast("Image attached to Question " + (i + 1));
    };
    im.src = r.result;
  };
  r.readAsDataURL(file);
}

// Paste image support
document.addEventListener("paste", e => {
  const c = e.target.closest && e.target.closest(".qc");
  if (!c) return;
  const f = [...e.clipboardData.files].find(f => f.type.startsWith("image/"));
  if (f) {
    e.preventDefault();
    setImg(+c.dataset.i, f);
  }
});

/* =========================================================================
   Math Toolbar & Symbol Palettes
   ========================================================================= */

const PALETTES = {
  alg: [
    ["x²", "^{2}"], ["xⁿ", "^{n}"], ["xₙ", "_{n}"], ["a/b", "\\frac{a}{b}"],
    ["√x", "\\sqrt{x}"], ["ⁿ√x", "\\sqrt[n]{x}"], ["|x|", "\\left|x\\right|"],
    ["( )", "\\left( \\right)"], ["[ ]", "\\left[ \\right]"], ["{ }", "\\left\\{ \\right\\}"],
    ["x̄", "\\bar{x}"], ["x̂", "\\hat{x}"]
  ],
  sym: [
    ["±", "\\pm"], ["×", "\\times"], ["÷", "\\div"], ["·", "\\cdot"],
    ["≠", "\\neq"], ["≤", "\\leq"], ["≥", "\\geq"], ["≈", "\\approx"],
    ["≡", "\\equiv"], ["∝", "\\propto"], ["°", "^\\circ"], ["∞", "\\infty"],
    ["∠", "\\angle"], ["△", "\\triangle"], ["⊥", "\\perp"], ["∥", "\\parallel"]
  ],
  calc: [
    ["∫", "\\int_{a}^{b} x\\,dx"], ["∬", "\\iint"], ["∮", "\\oint"],
    ["∑", "\\sum_{i=1}^{n}"], ["∏", "\\prod_{i=1}^{n}"], ["lim", "\\lim_{x\\to 0}"],
    ["dy/dx", "\\frac{dy}{dx}"], ["∂f/∂x", "\\frac{\\partial f}{\\partial x}"],
    ["∈", "\\in"], ["∉", "\\notin"], ["⊂", "\\subset"], ["∪", "\\cup"], ["∩", "\\cap"]
  ],
  greek: [
    ["α", "\\alpha"], ["β", "\\beta"], ["γ", "\\gamma"], ["θ", "\\theta"],
    ["λ", "\\lambda"], ["μ", "\\mu"], ["π", "\\pi"], ["σ", "\\sigma"],
    ["φ", "\\phi"], ["ω", "\\omega"], ["Δ", "\\Delta"], ["Ω", "\\Omega"]
  ],
  sci: [
    ["v⃗", "\\vec{v}"], ["→", "\\to"], ["⇌", "\\rightleftharpoons"],
    ["↑", "\\uparrow"], ["↓", "\\downarrow"], ["ΔH", "\\Delta H"],
    ["mol", "\\text{ mol}"], ["m/s²", "\\text{ m/s}^2"], ["Hz", "\\text{ Hz}"]
  ]
};

let activePalette = "alg";
function renderPalette() {
  const syms = PALETTES[activePalette] || [];
  $("tb").innerHTML = syms.map(([lbl, val]) => `
    <button class="math-sym-btn" data-val="${esc(val)}" title="${esc(val)}">${lbl}</button>
  `).join("");
}
renderPalette();

document.querySelectorAll(".math-cat-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".math-cat-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activePalette = btn.dataset.cat;
    renderPalette();
  };
});

let lastFocusedField = null;
document.addEventListener("focusin", e => {
  if (e.target.matches("textarea, input[type=text]")) {
    lastFocusedField = e.target;
  }
});

$("tb").addEventListener("mousedown", e => e.preventDefault());
$("tb").addEventListener("click", e => {
  const btn = e.target.closest("button");
  if (!btn || !lastFocusedField) return;
  const sn = btn.dataset.val;
  const f = lastFocusedField;
  const p1 = f.selectionStart;
  const p2 = f.selectionEnd;
  const v = f.value;

  const insideMath = (v.slice(0, p1).match(/\$/g) || []).length % 2 === 1;
  const insertText = insideMath ? sn : `$${sn}$`;

  f.value = v.slice(0, p1) + insertText + v.slice(p2);
  f.focus();
  const newPos = p1 + insertText.length;
  f.setSelectionRange(newPos, newPos);
  f.dispatchEvent(new Event("input", { bubbles: true }));
});

/* =========================================================================
   Option Layouts & Question HTML
   ========================================================================= */

function lay(q, s) {
  let v = q.ol || s.ol;
  const len = q.o.length;
  if (v === "auto") {
    const maxChars = Math.max(...q.o.map(o => (o || "").replace(/\$|\\[a-zA-Z]+/g, "").length));
    if (len === 2) v = maxChars <= 18 ? "row-2" : "col";
    else if (len === 3) v = maxChars <= 14 ? "row-3" : "col";
    else if (len === 5) v = maxChars <= 8 ? "row-5" : "col";
    else v = maxChars <= 10 ? "row" : maxChars <= 28 ? "grid" : "col";
  } else if (v === "row") {
    if (len === 2) v = "row-2";
    else if (len === 3) v = "row-3";
    else if (len === 5) v = "row-5";
  }
  return v;
}

function qHTML(q, i, s) {
  const isTeacher = s.mode === "teacher";
  const marksBadge = (Number(q.marks) || 1) !== 1 ? `<span class="q-marks">[${q.marks} marks]</span>` : '';

  return `
    <div class="q">
      <div class="q-title">
        <div><b>${i + 1}.</b> ${rich(q.q)}</div>
        ${marksBadge}
      </div>
      ${q.img ? `
        <div class="qimg">
          <img src="${q.img.src}" style="width:${q.img.wmm}mm;aspect-ratio:${q.img.nw}/${q.img.nh}">
        </div>
      ` : ""}
      <div class="opts o-${lay(q, s)}">
        ${q.o.map((o, j) => {
          const isCorrect = isTeacher && q.a === j;
          return `
            <span class="op ${isCorrect ? "correct-marked" : ""}">
              <span>(${L[j]})</span>
              <span class="ot">${rich(o, 1)}</span>
              ${isCorrect ? '<span class="teacher-tick">✓</span>' : ''}
            </span>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

/* =========================================================================
   Answer Key & OMR Generator
   ========================================================================= */

function keyCompactHTML() {
  if (!qs.length) return "";
  const pairs = qs.map((q, i) => `<b>${i + 1}.</b> ${L[q.a]}`).join("&nbsp;&nbsp;&nbsp; ");
  return `
    <div class="key-box">
      <div class="key-box-title">ANSWER KEY:</div>
      <div>${pairs}</div>
    </div>
  `;
}

function keyTableHTML(includeExpl) {
  if (!qs.length) return "";
  let rows = "";
  for (let i = 0; i < qs.length; i += 5) {
    const chunk = qs.slice(i, i + 5);
    rows += `<tr>${chunk.map((q, idx) => `<th>Q${i + idx + 1}</th>`).join("")}</tr>`;
    rows += `<tr>${chunk.map(q => `<td><b>${L[q.a]}</b></td>`).join("")}</tr>`;
  }
  const expls = includeExpl
    ? qs.map((q, i) => q.exp ? `<div><b>Q${i + 1}:</b> ${rich(q.exp)}</div>` : "").filter(Boolean).join("")
    : "";

  return `
    <div class="key-box" style="margin-top:20px">
      <h2 style="text-align:center;font-size:1.3em;margin-bottom:8px">EXAMINATION ANSWER KEY &amp; SOLUTIONS</h2>
      <table class="key-grid-table">${rows}</table>
      ${expls ? `<div style="margin-top:14px;font-size:0.9em"><b>Explanations / Solutions:</b>${expls}</div>` : ""}
    </div>
  `;
}

function omrSheetHTML(s) {
  const qCount = qs.length || 20;
  const cols = 4;
  const perCol = Math.ceil(qCount / cols);

  let colHtml = "";
  for (let c = 0; c < cols; c++) {
    let items = "";
    for (let r = 0; r < perCol; r++) {
      const idx = c * perCol + r;
      if (idx >= qCount) break;
      const num = String(idx + 1).padStart(2, "0");
      items += `
        <div class="omr-q-row">
          <span class="omr-q-num">${num}</span>
          <div>
            <span class="omr-bubble">A</span>
            <span class="omr-bubble">B</span>
            <span class="omr-bubble">C</span>
            <span class="omr-bubble">D</span>
          </div>
        </div>
      `;
    }
    colHtml += `<div>${items}</div>`;
  }

  return `
    <div class="omr-container">
      <div class="omr-header">
        <h2 style="margin:0 0 2px;font-size:16px">${esc(s.inst || s.title)}</h2>
        <div style="font-weight:700;font-size:13px">${esc(s.title)} — OMR RESPONSE SHEET</div>
      </div>
      <div class="omr-student-grid">
        <div>
          <div><b>Candidate Name:</b> ________________________________________________</div>
          <div style="margin-top:8px"><b>Subject:</b> ${esc(s.subject)} &nbsp;&nbsp;&nbsp; <b>Class:</b> ${esc(s.grade)} &nbsp;&nbsp;&nbsp; <b>Date:</b> _________</div>
        </div>
        <div style="border-left:1px solid #000;padding-left:8px">
          <div><b>Roll Number / Candidate ID:</b></div>
          <div style="display:flex;gap:4px;margin-top:4px">
            ${Array(6).fill('<div style="width:18px;height:24px;border:1px solid #000"></div>').join("")}
          </div>
        </div>
      </div>
      <div style="font-size:10px;margin-bottom:10px;color:#333">
        <b>Instructions:</b> Use blue or black ballpoint pen only. Darken circles completely: <b>(A) [●] (C) (D)</b>. Do not make stray marks.
      </div>
      <div class="omr-col-grid">
        ${colHtml}
      </div>
    </div>
  `;
}

/* =========================================================================
   Pagination & Screen Preview Layout Engine
   ========================================================================= */

function dimsMM(s) {
  let d = [210, 297]; // A4 default
  if (s.size === "Letter") d = [215.9, 279.4];
  if (s.size === "Legal") d = [215.9, 355.6];
  return s.or === "l" ? [d[1], d[0]] : d;
}

let previewDebounceTimer = null;
function debouncedPreview() {
  clearTimeout(previewDebounceTimer);
  previewDebounceTimer = setTimeout(preview, 100);
}

let currentZoom = "fit";

function getMargins(s) {
  const m = s.margin || "compact";
  // Returns: top/bot/side = sheet outer padding (mm); print = @page margin; gutter = inner cut-edge padding per tile
  if (m === "tight")   return { top: 4,  side: 5,  bot: 4,  print: 3,  gutter: 6  };
  if (m === "compact") return { top: 6,  side: 8,  bot: 6,  print: 5,  gutter: 8  };
  if (m === "normal")  return { top: 10, side: 12, bot: 10, print: 8,  gutter: 12 };
  if (m === "spacious")return { top: 14, side: 16, bot: 14, print: 12, gutter: 16 };
  // duplex: generous outer margin + wide gutter so front/back content clears the cut line
  // outer side 12mm, gutter 18mm (9mm each side of cut = 18mm safe zone at cut)
  return { top: 12, side: 12, bot: 12, print: 10, gutter: 18, duplex: true };
}

function preview() {
  const s = S();
  const [w, h] = dimsMM(s);
  const mg = getMargins(s);
  const isMultiCopy = s.copies > 1;
  const tc = tileCols(s);
  const rows = s.copies / tc;

  $("cols").disabled = isMultiCopy;

  // Update mode tags
  const isTeacher = s.mode === "teacher";
  const tag = $("preview-mode-tag");
  tag.textContent = isTeacher ? "👨‍🏫 Teacher Master Copy" : "🎓 Student Copy";
  tag.style.background = isTeacher ? "var(--success)" : "rgba(255,255,255,0.1)";

  // Compute Full Marks display
  const calculatedMarks = totalMarksCalc();
  const fullMarksText = s.marks && s.marks.toLowerCase() !== "auto" ? s.marks : calculatedMarks + " Marks";

  const makeExamHeader = () => {
    const hasMeta = s.subject || s.grade || s.time || (s.marks && s.marks.toLowerCase() !== "auto") || calculatedMarks;
    const hasStudent = s.showName || s.showRoll || s.showSec || s.showDate;

    return `
      <div class="exam-header">
        ${s.inst ? `<div class="inst-name">${esc(s.inst)}</div>` : ""}
        <div class="exam-title">${esc(s.title)}</div>
        ${hasMeta ? `
          <div class="exam-meta-grid">
            ${s.subject ? `<span><b>Subject:</b> ${esc(s.subject)}</span>` : ""}
            ${s.grade ? `<span><b>Class:</b> ${esc(s.grade)}</span>` : ""}
            ${s.time ? `<span><b>Time:</b> ${esc(s.time)}</span>` : ""}
            <span><b>Full Marks:</b> ${esc(fullMarksText)}</span>
          </div>
        ` : ""}
        ${s.instructions ? `<div class="exam-instructions">${esc(s.instructions)}</div>` : ""}
        ${hasStudent ? `
          <div class="student-info-box">
            ${s.showName ? `<span>Name: ____________________</span>` : ""}
            ${s.showRoll ? `<span>Roll No: ________</span>` : ""}
            ${s.showSec ? `<span>Sec: ______</span>` : ""}
            ${s.showDate ? `<span>Date: ________</span>` : ""}
          </div>
        ` : ""}
      </div>
    `;
  };

  // Build items list
  const its = qs.map((q, i) => qHTML(q, i, s));
  if (s.keyMode === "end" && qs.length) {
    its.push(keyCompactHTML());
  }

  const wrap = $("wrap");
  wrap.innerHTML = "";
  const sheets = [];
  let idx = 0;

  // Pagination loop
  do {
    const isFirstPage = sheets.length === 0;
    const sh = document.createElement("div");
    sh.className = "sheet";
    // Multi-copy: tiles handle all padding internally; outer sheet gets no padding (border shown instead)
    const sheetPad = isMultiCopy
      ? `0mm`
      : `${mg.top}mm ${mg.side}mm ${mg.bot}mm`;
    sh.style.cssText = `width:${w}mm;height:${h}mm;padding:${sheetPad};font-family:${s.font};font-size:${s.fs}pt`;

    const tl = document.createElement("div");
    tl.className = "tiles";
    tl.style.cssText = `grid-template-columns:repeat(${tc},minmax(0,1fr));grid-template-rows:repeat(${rows},minmax(0,1fr))`;

    const bodies = [];
    const gutter = mg.gutter || mg.side;
    for (let t = 0; t < s.copies; t++) {
      const tile = document.createElement("div");
      tile.className = "tile" + (isMultiCopy ? " c" : "");
      // Per-tile gutter: apply half of gutter to each inner edge so total gap at cut = gutter mm
      if (isMultiCopy) {
        const col = t % tc; // column index
        const row = Math.floor(t / tc); // row index
        const halfG = (gutter / 2).toFixed(1);
        const outerSide = mg.side;
        // Horizontal: left tile gets normal left, inner right; right tile gets inner left, normal right
        const pl = tc > 1 ? (col === 0 ? `${outerSide}mm` : `${halfG}mm`) : `${outerSide}mm`;
        const pr = tc > 1 ? (col === tc - 1 ? `${outerSide}mm` : `${halfG}mm`) : `${outerSide}mm`;
        // Vertical: top tile gets normal top, inner bottom; bottom tile gets inner top, normal bottom
        const pt = rows > 1 ? (row === 0 ? `${mg.top}mm` : `${halfG}mm`) : `${mg.top}mm`;
        const pb = rows > 1 ? (row === rows - 1 ? `${mg.bot}mm` : `${halfG}mm`) : `${mg.bot}mm`;
        tile.style.cssText = `padding:${pt} ${pr} ${pb} ${pl};box-sizing:border-box;`;
      }
      tile.innerHTML = (isFirstPage ? makeExamHeader() : "") + `<div class="body" style="column-count:${isMultiCopy ? 1 : s.cols}"></div>`;
      tl.appendChild(tile);
      bodies.push(tile.querySelector(".body"));
    }
    // Render cut guides between tiles
    if (isMultiCopy) {
      if (tc > 1) {
        // Vertical cut line (between columns)
        const vCut = document.createElement("div");
        vCut.className = "cut-v";
        vCut.innerHTML = `<span class="cut-label">✂ Cut here</span>`;
        sh.appendChild(vCut);
      }
      if (rows > 1) {
        // Horizontal cut line (between rows)
        const hCut = document.createElement("div");
        hCut.className = "cut-h";
        hCut.innerHTML = `<span class="cut-label cut-label-h">✂ Cut here</span>`;
        sh.appendChild(hCut);
      }
    }

    sh.appendChild(tl);
    wrap.appendChild(sh);
    sheets.push(sh);

    const b0 = bodies[0];
    const tile0 = b0.closest ? (b0.closest(".tile") || b0.parentElement) : b0.parentElement;
    let k = 0;
    while (idx + k < its.length) {
      b0.insertAdjacentHTML("beforeend", its[idx + k]);
      const overflows =
        b0.scrollHeight > b0.clientHeight ||
        b0.scrollWidth > b0.clientWidth + 1 ||
        (tile0 && tile0.scrollHeight > tile0.clientHeight) ||
        sh.scrollHeight > sh.clientHeight;

      if (overflows) {
        if (k > 0) b0.lastElementChild.remove();
        else k = 1; // Question is larger than whole page, keep to avoid infinite loop
        break;
      }
      k++;
    }
    idx += k;

    // Sync content to other tiles for 2 or 4 copies
    for (let t = 1; t < bodies.length; t++) {
      bodies[t].innerHTML = b0.innerHTML;
    }
  } while (idx < its.length && sheets.length < 50);

  // Dedicated Separate Page for Answer Key
  if (s.keyMode === "separate" && qs.length) {
    const sh = document.createElement("div");
    sh.className = "sheet";
    // Multi-copy: tiles handle all padding internally; outer sheet gets no padding (border shown instead)
    const sheetPad = isMultiCopy
      ? `0mm`
      : `${mg.top}mm ${mg.side}mm ${mg.bot}mm`;
    sh.style.cssText = `width:${w}mm;height:${h}mm;padding:${sheetPad};font-family:${s.font};font-size:${s.fs}pt`;
    sh.innerHTML = keyTableHTML(s.keyExpl);
    wrap.appendChild(sh);
    sheets.push(sh);
  }

  // Attached Printable OMR Bubble Sheet
  if (s.showOMR && qs.length) {
    const sh = document.createElement("div");
    sh.className = "sheet";
    sh.style.cssText = `width:${w}mm;height:${h}mm;padding:0;overflow:hidden`;
    sh.innerHTML = omrSheetHTML(s);
    wrap.appendChild(sh);
    sheets.push(sh);
  }

  // Zoom and layout scaling calculation
  applyZoom(sheets, w, h);

  // Dynamic Print Stylesheet
  let st = $("pg");
  if (!st) {
    st = document.createElement("style");
    st.id = "pg";
    document.head.appendChild(st);
  }
  st.textContent = `
    @page {
      size: ${s.size} ${s.or === "l" ? "landscape" : "portrait"};
      margin: 0;
    }
    @media print {
      .sheet {
        width: ${w}mm !important;
        height: ${h}mm !important;
        max-width: ${w}mm !important;
        max-height: ${h}mm !important;
        margin: 0 !important;
        position: relative;
        box-sizing: border-box !important;
      }
      .cut-v, .cut-h, .cut-label {
        display: none !important;
      }
    }
  `;

  $("page-count-badge").textContent = `Pages: ${sheets.length}`;
  queueSave();
}

function applyZoom(sheets, w, h) {
  const containerW = $("wrap").parentElement.clientWidth - 48;
  const baseScale = containerW / (w * 3.7795);

  let z = 1;
  if (currentZoom === "fit") {
    z = Math.min(1.15, Math.max(0.4, baseScale));
    $("z-val").textContent = "Fit";
  } else {
    z = Number(currentZoom) || 1;
    $("z-val").textContent = Math.round(z * 100) + "%";
  }

  sheets.forEach((sh, i) => {
    let sw = sh.parentElement;
    if (!sw || !sw.classList.contains("sw")) {
      sw = document.createElement("div");
      sw.className = "sw";
      $("wrap").insertBefore(sw, sh);
      sw.appendChild(sh);

      const pl = document.createElement("div");
      pl.className = "pl noprint";
      pl.textContent = `Page ${i + 1} of ${sheets.length}`;
      sw.insertBefore(pl, sh);
    }
    sw.style.width = `${w * z}mm`;
    sw.style.height = `${h * z}mm`;
    sh.style.transform = `scale(${z})`;
  });
}

// Zoom controls
$("z-out").onclick = () => {
  let cur = currentZoom === "fit" ? 0.8 : Number(currentZoom);
  currentZoom = Math.max(0.4, Math.round((cur - 0.1) * 10) / 10);
  preview();
};
$("z-in").onclick = () => {
  let cur = currentZoom === "fit" ? 0.8 : Number(currentZoom);
  currentZoom = Math.min(1.8, Math.round((cur + 0.1) * 10) / 10);
  preview();
};
$("z-fit").onclick = () => {
  currentZoom = "fit";
  preview();
};
$("z-100").onclick = () => {
  currentZoom = 1;
  preview();
};
$("btn-quick-toggle").onclick = () => {
  const newMode = $("mode").value === "student" ? "teacher" : "student";
  $("mode").value = newMode;
  $("btn-quick-toggle").textContent = newMode === "teacher" ? "Student View" : "Teacher View";
  preview();
};

// Listen to all setup input changes
[
  "inst", "title", "subject", "grade", "time", "marks", "instructions",
  "hdr-name", "hdr-roll", "hdr-sec", "hdr-date",
  "size", "or", "margin", "cols", "copies", "font", "fs", "ol", "mode", "key-mode", "key-expl", "show-omr"
].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener("input", debouncedPreview);
});

// Sync answer-key dropdowns: top-key-mode and key-mode-export mirror key-mode (authoritative)
["top-key-mode", "key-mode-export"].forEach(id => {
  const el = $(id);
  if (!el) return;
  el.addEventListener("change", () => {
    $("key-mode").value = el.value;
    const other = id === "top-key-mode" ? "key-mode-export" : "top-key-mode";
    if ($(other)) $(other).value = el.value;
    debouncedPreview();
  });
});
// key-mode (Setup tab) also syncs the mirrors when changed via Setup tab
$("key-mode").addEventListener("change", () => {
  const v = $("key-mode").value;
  if ($("top-key-mode")) $("top-key-mode").value = v;
  if ($("key-mode-export")) $("key-mode-export").value = v;
  debouncedPreview();
});

window.addEventListener("resize", debouncedPreview);

$("bprint").onclick = () => { preview(); window.print(); };
$("bpdf").onclick = () => { preview(); window.print(); };
$("btn-top-print").onclick = () => { preview(); window.print(); };

/* =========================================================================
   DOCX Export
   ========================================================================= */

async function mathPNG(tex, disp, fpx) {
  const k = (disp ? "d" : "i") + fpx + tex;
  const svg = MathJax.tex2svg(tex, { display: !!disp }).querySelector("svg");
  if (!svg) return null;
  const vb = svg.getAttribute("viewBox").split(/\s+/).map(Number);
  const w = (vb[2] / 1000) * fpx;
  const h = (vb[3] / 1000) * fpx;

  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", w + "px");
  svg.setAttribute("height", h + "px");
  svg.removeAttribute("style");

  const xml = svg.outerHTML.replace(/currentColor/g, "#000");
  const img = new Image();
  await new Promise((ok, no) => {
    img.onload = ok;
    img.onerror = no;
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  });

  const sc = 3;
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(w * sc);
  cv.height = Math.ceil(h * sc);
  cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
  const blob = await new Promise(r => cv.toBlob(r));
  return { data: new Uint8Array(await blob.arrayBuffer()), w, h };
}

$("bdoc").onclick = async () => {
  if (!window.docx) {
    alert("DOCX export library is loading. Please check your internet connection.");
    return;
  }
  const btn = $("bdoc");
  btn.disabled = true;
  btn.textContent = "Generating Word Document...";

  try {
    const D = docx;
    const s = S();
    const sz = s.fs * 2;
    const fpx = (s.fs * 96) / 72;

    const nb = { style: D.BorderStyle.NONE, size: 0, color: "FFFFFF" };
    const nob = { top: nb, bottom: nb, left: nb, right: nb, insideHorizontal: nb, insideVertical: nb };
    const dims = s.size === "A4" ? [11906, 16838] : [12240, 15840];
    const page = {
      size: {
        width: dims[0],
        height: dims[1],
        orientation: s.or === "l" ? D.PageOrientation.LANDSCAPE : D.PageOrientation.PORTRAIT
      },
      margin: { top: 720, bottom: 720, left: 720, right: 720 }
    };

    const U = (s.or === "l" ? dims[1] : dims[0]) - 1440;
    const tc = tileCols(s);
    const inner = s.copies === 1 ? Math.floor((U - 420 * (s.cols - 1)) / s.cols) : Math.floor(U / tc) - 280;
    const avail = (inner / 15) * 0.95;
    const DXA = D.WidthType.DXA;

    const P = (t, o = {}) => new D.Paragraph({
      children: [new D.TextRun({ text: t, size: sz, bold: !!o.b, italics: !!o.it })],
      spacing: { before: o.before || 0, after: o.after ?? 40 },
      alignment: o.al || D.AlignmentType.LEFT
    });

    const head = () => {
      const hList = [];
      if (s.inst) {
        hList.push(new D.Paragraph({
          alignment: D.AlignmentType.CENTER,
          children: [new D.TextRun({ text: s.inst.toUpperCase(), bold: true, size: sz + 8 })],
          spacing: { after: 40 }
        }));
      }
      hList.push(new D.Paragraph({
        alignment: D.AlignmentType.CENTER,
        children: [new D.TextRun({ text: s.title, bold: true, size: sz + 4 })],
        spacing: { after: 60 }
      }));

      const metaLine = [
        s.subject ? `Subject: ${s.subject}` : "",
        s.grade ? `Class: ${s.grade}` : "",
        s.time ? `Time: ${s.time}` : "",
        `Full Marks: ${s.marks || totalMarksCalc()}`
      ].filter(Boolean).join("    |    ");

      hList.push(P(metaLine, { b: true, al: D.AlignmentType.CENTER, after: 80 }));

      if (s.instructions) {
        hList.push(P(`Instructions: ${s.instructions}`, { it: true, after: 80 }));
      }

      const stFields = [];
      if (s.showName) stFields.push("Name: ______________________");
      if (s.showRoll) stFields.push("Roll No: _______");
      if (s.showSec) stFields.push("Section: _____");
      if (s.showDate) stFields.push("Date: _________");
      if (stFields.length) {
        hList.push(P(stFields.join("    "), { after: 120 }));
      }
      return hList;
    };

    const rp = async (t, o = {}) => {
      const out = [];
      let first = true;
      let runs = o.pre ? [new D.TextRun({ text: o.pre, bold: !!o.bp, size: sz })] : [];

      const flush = al => {
        out.push(new D.Paragraph({
          children: runs.length ? runs : [new D.TextRun({ text: "", size: sz })],
          alignment: al,
          spacing: { before: first ? (o.before || 0) : 0, after: o.after ?? 40 },
          keepNext: !!o.kn
        }));
        runs = [];
        first = false;
      };

      for (const g of segs(t || "")) {
        if (g.t !== undefined) {
          g.t.split("\n").forEach((ln, i) => runs.push(new D.TextRun({ text: ln, size: sz, break: i ? 1 : 0 })));
          continue;
        }
        let m = null;
        if (mj()) {
          try { m = await mathPNG(g.m, g.d && !o.inl, fpx); } catch (e) {}
        }
        if (!m) {
          runs.push(new D.TextRun({ text: "$" + g.m + "$", size: sz }));
          continue;
        }
        const im = new D.ImageRun({
          data: m.data,
          type: "png",
          transformation: { width: Math.max(1, Math.round(m.w)), height: Math.max(1, Math.round(m.h)) }
        });
        if (g.d && !o.inl) {
          if (runs.length) flush();
          runs.push(im);
          flush(D.AlignmentType.CENTER);
        } else {
          runs.push(im);
        }
      }
      if (runs.length || !out.length) flush();
      return out;
    };

    const qImg = q => {
      if (!q.img) return [];
      const data = Uint8Array.from(atob(q.img.src.split(",")[1]), c => c.charCodeAt(0));
      const w = Math.min((q.img.wmm * 96) / 25.4, avail);
      const hh = (w * q.img.nh) / q.img.nw;
      return [new D.Paragraph({
        alignment: D.AlignmentType.CENTER,
        keepNext: true,
        spacing: { after: 40 },
        children: [new D.ImageRun({ data, type: "png", transformation: { width: Math.round(w), height: Math.round(hh) } })]
      })];
    };

    const body = async () => {
      const out = [];
      const isTeacher = s.mode === "teacher";

      for (const [i, q] of qs.entries()) {
        const marksTxt = (Number(q.marks) || 1) !== 1 ? `  [${q.marks} marks]` : '';
        out.push(...await rp(q.q + marksTxt, { pre: `${i + 1}. `, bp: 1, before: 100, kn: 1, after: 60 }));
        out.push(...qImg(q));

        const ly = lay(q, s);
        const optCount = q.o.length;

        if (ly === "col") {
          for (let j = 0; j < optCount; j++) {
            const mark = isTeacher && q.a === j ? " [✓]" : "";
            out.push(...await rp(q.o[j] + mark, { pre: `(${L[j]}) `, inl: 1, after: 30 }));
          }
        } else {
          const n = ly.includes("row") ? optCount : 2;
          const rows = [];
          const cw = Math.floor(inner / n);

          for (let k = 0; k < optCount; k += n) {
            const cells = [];
            for (let j = k; j < Math.min(k + n, optCount); j++) {
              const mark = isTeacher && q.a === j ? " [✓]" : "";
              cells.push(new D.TableCell({
                width: { size: cw, type: DXA },
                borders: nob,
                children: await rp(q.o[j] + mark, { pre: `(${L[j]}) `, inl: 1, after: 20 })
              }));
            }
            rows.push(new D.TableRow({ cantSplit: true, children: cells }));
          }
          out.push(new D.Table({
            width: { size: cw * n, type: DXA },
            columnWidths: Array(n).fill(cw),
            layout: D.TableLayoutType.FIXED,
            borders: nob,
            rows
          }));
        }
      }

      if (s.keyMode !== "none" && qs.length) {
        const keyTxt = qs.map((q, i) => `${i + 1}-${L[q.a]}`).join(",  ");
        out.push(P("ANSWER KEY: " + keyTxt, { b: true, before: 200 }));
      }
      return out;
    };

    let sections;
    if (s.copies === 1) {
      sections = [
        { properties: { page }, children: head() },
        { properties: { page, type: D.SectionType.CONTINUOUS, column: { count: s.cols, space: 420 } }, children: await body() }
      ];
    } else {
      const rows = [];
      const cw = Math.floor(U / tc);
      for (let r = 0; r < s.copies / tc; r++) {
        const cells = [];
        for (let c = 0; c < tc; c++) {
          cells.push(new D.TableCell({
            width: { size: cw, type: DXA },
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            children: [...head(), ...await body()]
          }));
        }
        rows.push(new D.TableRow({ children: cells }));
      }
      sections = [
        {
          properties: { page },
          children: [
            new D.Table({
              width: { size: cw * tc, type: DXA },
              columnWidths: Array(tc).fill(cw),
              layout: D.TableLayoutType.FIXED,
              borders: nob,
              rows
            })
          ]
        }
      ];
    }

    const blob = await D.Packer.toBlob(new D.Document({ sections }));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (s.title || "mcq_exam").replace(/[^\w-]+/g, "_") + ".docx";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    showToast("DOCX file generated and downloaded!");
  } catch (err) {
    alert("DOCX export error: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "📝 Word (.docx)";
  }
};

/* =========================================================================
   Smart Text & AI Import Parser
   ========================================================================= */

function parseRaw(txt) {
  const out = [];
  let cur = null;
  let blank = true;

  const optRe = /^\s*(\*?)\s*\(?([A-Fa-f])[\)\.\:\-]\s*(\*?)\s*(.*?)\s*(\*?)\s*$/;
  const ansRe = /^\s*(?:correct\s*answer|answer|ans|key)\s*[:\-=]\s*\(?([A-Fa-f])\b/i;
  const explRe = /^\s*(?:explanation|solution|reason)\s*[:\-=]\s*(.*)$/i;
  const numRe = /^\s*(?:q(?:uestion)?\s*)?\d+\s*[\.\)\:\-]\s*/i;

  const strip = s => s.replace(numRe, "").replace(/^\*+|\*+$/g, "").trim();

  const start = t => {
    cur = { q: t, o: [], a: -1, exp: "", marks: 1 };
    out.push(cur);
  };

  const lines = txt.replace(/\r/g, "").split("\n");

  for (let raw of lines) {
    let line = raw.trim();
    if (!line) {
      blank = true;
      continue;
    }

    // Clean AI markdown bullets like "- A) option" or "**Question 1:**"
    line = line.replace(/^[\*\-\+]\s+/, "");

    // Check for layout directive
    const lm = line.match(/^\s*layout\s*[:=]\s*(?:(1\s*[x×*]\s*4)|(2\s*[x×*]\s*2)|(4\s*[x×*]\s*1)|(auto))/i);
    if (lm && cur) {
      cur.ol = lm[1] ? "row" : lm[2] ? "grid" : lm[3] ? "col" : "auto";
      blank = false;
      continue;
    }

    // Check for Explanation
    const em = line.match(explRe);
    if (em && cur) {
      cur.exp = em[1].trim();
      blank = false;
      continue;
    }

    // Check for Answer line
    const am = line.match(ansRe);
    if (am && cur) {
      cur.a = "ABCDEF".indexOf(am[1].toUpperCase());
      blank = false;
      continue;
    }

    // Check for inline options: A) ... B) ... C) ... D) ...
    let parts = [line];
    if (/\(?[Aa][\)\.\:]\s.*\(?[Bb][\)\.\:]\s/.test(line)) {
      parts = line.split(/\s+(?=\(?[A-Fa-f][\)\.\:]\s)/);
    }

    for (const p of parts) {
      const m = p.match(optRe);
      if (m && cur && cur.o.length < 6) {
        cur.o.push(m[4]);
        if (m[1] || m[3] || m[5]) cur.a = cur.o.length - 1;
      } else if (cur && !cur.o.length && !blank && !numRe.test(p)) {
        cur.q += " " + p;
      } else {
        start(strip(p));
      }
      blank = false;
    }
  }

  let noAns = 0;
  const list = out.filter(q => q.q).map(q => {
    while (q.o.length < 4) q.o.push("");
    if (q.a < 0) {
      q.a = 0;
      noAns++;
    }
    return q;
  });

  return { list, noAns };
}

function doImport(replace) {
  const txt = $("raw").value.trim();
  if (!txt) {
    $("imsg").textContent = "Please paste questions into the text box first.";
    return;
  }
  const { list, noAns } = parseRaw(txt);
  if (!list.length) {
    $("imsg").textContent = "Could not parse questions. Ensure questions and options (A-D) are structured properly.";
    return;
  }
  if (replace) qs = list;
  else qs = qs.concat(list);

  renderList();
  preview();
  $("imsg").textContent = `Successfully imported ${list.length} question${list.length > 1 ? "s" : ""}.` +
    (noAns ? ` (${noAns} had no answer marked, defaulted to A)` : "");
  $("raw").value = "";
  showToast(`Imported ${list.length} questions`);
}

$("impadd").onclick = () => doImport(false);
$("imprep").onclick = () => {
  if (!qs.length || confirm("Replace all current questions with the imported ones?")) {
    doImport(true);
  }
};

$("impfile").onchange = e => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    $("raw").value = r.result;
    $("imsg").textContent = `File "${f.name}" loaded into editor. Choose Import & Append or Replace.`;
  };
  r.readAsText(f);
  e.target.value = "";
};

/* =========================================================================
   Sample Test Presets
   ========================================================================= */

$("load-sample-math").onclick = () => {
  if (qs.length && !confirm("Replace current questions with Mathematics Sample Test?")) return;
  qs = [
    {
      q: "Evaluate the limit: $$\\lim_{x \\to 0} \\frac{\\sin(3x)}{x}$$",
      o: ["$0$", "$1$", "$3$", "Does not exist"],
      a: 2,
      ol: "row",
      marks: 1,
      exp: "Using $\\lim_{x \\to 0} \\frac{\\sin(kx)}{kx} = 1$, we get $3 \\times 1 = 3$."
    },
    {
      q: "If $f(x) = x^3 - 3x^2 + 2$, what is the derivative $f'(x)$?",
      o: ["$3x^2 - 6x$", "$3x^2 - 3$", "$x^2 - 6x$", "$3x^2 - 6x + 2$"],
      a: 0,
      ol: "grid",
      marks: 1,
      exp: "Differentiating term by term gives $3x^2 - 6x$."
    },
    {
      q: "The discriminant of the quadratic equation $ax^2 + bx + c = 0$ is",
      o: ["$b^2 - 4ac$", "$b^2 + 4ac$", "$\\sqrt{b^2 - 4ac}$", "$4ac - b^2$"],
      a: 0,
      ol: "grid",
      marks: 1,
      exp: "Discriminant $\\Delta = b^2 - 4ac$."
    },
    {
      q: "The solution to the matrix equation $\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$ determinant is",
      o: ["$-2$", "$2$", "$10$", "$-10$"],
      a: 0,
      ol: "row",
      marks: 1,
      exp: "$\\det = (1)(4) - (2)(3) = 4 - 6 = -2$."
    }
  ];
  $("title").value = "Mathematics Final Examination";
  $("subject").value = "Calculus & Algebra";
  renderList();
  preview();
  showToast("Loaded Math & Calculus Sample");
};

$("load-sample-physics").onclick = () => {
  if (qs.length && !confirm("Replace current questions with Science Sample Test?")) return;
  qs = [
    {
      q: "According to Newton's Second Law of Motion, the formula for force $\\vec{F}$ is",
      o: ["$\\vec{F} = m\\vec{a}$", "$\\vec{F} = \\frac{m}{\\vec{a}}$", "$\\vec{F} = \\frac{1}{2}m\\vec{v}^2$", "$\\vec{F} = m\\vec{g}h$"],
      a: 0,
      ol: "grid",
      marks: 1,
      exp: "Force is the product of mass and acceleration."
    },
    {
      q: "What is the pH value of pure water at $25^\\circ\\text{C}$?",
      o: ["$0$", "$7$", "$14$", "$1$"],
      a: 1,
      ol: "row",
      marks: 1,
      exp: "Pure neutral water has a pH of exactly 7."
    },
    {
      q: "Which law explains why a ship made of steel floats on water?",
      o: ["Pascal's Principle", "Archimedes' Principle", "Bernoulli's Theorem", "Hooke's Law"],
      a: 1,
      ol: "col",
      marks: 1,
      exp: "Archimedes' principle states buoyant force equals the weight of displaced fluid."
    }
  ];
  $("title").value = "General Physics & Chemistry Quiz";
  $("subject").value = "Physical Sciences";
  renderList();
  preview();
  showToast("Loaded Science Sample");
};

$("load-sample-gk").onclick = () => {
  if (qs.length && !confirm("Replace current questions with General Knowledge Sample Test?")) return;
  qs = [
    {
      q: "Which planet in the solar system is known as the **Red Planet**?",
      o: ["Venus", "Mars", "Jupiter", "Saturn"],
      a: 1,
      ol: "row",
      marks: 1,
      exp: "Mars appears red due to iron oxide (rust) on its surface."
    },
    {
      q: "What is the primary gas found in the Earth's atmosphere?",
      o: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Argon"],
      a: 1,
      ol: "row",
      marks: 1,
      exp: "Nitrogen makes up approximately 78% of the atmosphere."
    },
    {
      q: "Who is known as the father of modern computer science?",
      o: ["Alan Turing", "Charles Babbage", "Ada Lovelace", "John von Neumann"],
      a: 0,
      ol: "grid",
      marks: 1,
      exp: "Alan Turing developed theoretical foundational concepts of computation."
    }
  ];
  $("title").value = "General Knowledge Assessment";
  $("subject").value = "General Science & Tech";
  renderList();
  preview();
  showToast("Loaded General Knowledge Sample");
};

/* =========================================================================
   Aiken Format Export
   ========================================================================= */

$("btn-export-aiken").onclick = () => {
  if (!qs.length) {
    alert("No questions to export.");
    return;
  }
  const lines = [];
  qs.forEach(q => {
    lines.push(q.q.replace(/\n/g, " "));
    q.o.forEach((o, j) => {
      lines.push(`${L[j]}. ${o}`);
    });
    lines.push(`ANSWER: ${L[q.a]}`);
    lines.push("");
  });
  $("aiken-txt").value = lines.join("\n");
  $("modal-aiken").showModal();
};

$("btn-close-aiken").onclick = () => $("modal-aiken").close();

$("btn-copy-aiken").onclick = () => {
  navigator.clipboard.writeText($("aiken-txt").value);
  showToast("Aiken text copied to clipboard!");
};

$("btn-download-aiken").onclick = () => {
  const b = new Blob([$("aiken-txt").value], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = (S().title || "questions") + "_aiken.txt";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

/* =========================================================================
   Enhanced Math Graph Plotter
   ========================================================================= */

let plotQ = 0;

function fnOf(s) {
  let e = s
    .replace(/^\s*(y|f\(x\))\s*=/i, "")
    .replace(/\^/g, "**")
    .replace(/(\d)\s*(?=[x\(]\b)/g, "$1*")
    .replace(/\)\s*(?=[x\(])/g, ")*")
    .replace(/\b(sin|cos|tan|asin|acos|atan|sqrt|cbrt|abs|exp|floor|ceil)\b/g, "Math.$1")
    .replace(/\bln\b/g, "Math.log")
    .replace(/\blog\b/g, "Math.log10")
    .replace(/\bpi\b/gi, "Math.PI")
    .replace(/\be\b/g, "Math.E")
    .trim();

  if (e[0] === "-" || e[0] === "+") e = "0" + e;
  return new Function("x", "return " + e);
}

const nice = r => {
  const p = 10 ** Math.floor(Math.log10(r));
  const f = r / p;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
};

function drawPlot() {
  const c = $("pc");
  const g = c.getContext("2d");
  const W = c.width;
  const H = c.height;
  const M = 80;

  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, W, H);

  let x0 = parseFloat($("px0").value);
  let x1 = parseFloat($("px1").value);
  if (!(x1 > x0)) { x0 = -5; x1 = 5; }

  let fns;
  try {
    fns = $("pf").value.split("\n").map(s => s.trim()).filter(Boolean).map(fnOf);
  } catch (e) {
    g.fillStyle = "#dc2626";
    g.font = "bold 26px sans-serif";
    g.fillText("Syntax error in function: " + e.message, 30, 60);
    return;
  }

  const N = 800;
  const pts = fns.map(f => {
    const a = [];
    for (let k = 0; k <= N; k++) {
      const x = x0 + ((x1 - x0) * k) / N;
      let y;
      try { y = f(x); } catch (err) { y = NaN; }
      a.push([x, y]);
    }
    return a;
  });

  let y0 = parseFloat($("py0").value);
  let y1 = parseFloat($("py1").value);
  if (!(y1 > y0)) {
    const ys = pts.flat().map(p => p[1]).filter(Number.isFinite).sort((a, b) => a - b);
    if (ys.length) {
      y0 = ys[Math.floor(ys.length * 0.02)];
      y1 = ys[Math.floor(ys.length * 0.98)];
      const pad = (y1 - y0 || 2) * 0.15;
      y0 -= pad;
      y1 += pad;
    } else {
      y0 = -5;
      y1 = 5;
    }
  }

  const X = x => M + ((x - x0) / (x1 - x0)) * (W - 2 * M);
  const Y = y => H - M - ((y - y0) / (y1 - y0)) * (H - 2 * M);

  const sx = nice((x1 - x0) / 10);
  const sy = nice((y1 - y0) * 0.125);

  const showGrid = $("pgrid").checked;
  const showArrows = $("parrows").checked;

  // Grid
  if (showGrid) {
    g.strokeStyle = "#e2e8f0";
    g.lineWidth = 1.5;
    for (let x = Math.ceil(x0 / sx) * sx; x <= x1 + 1e-9; x += sx) {
      g.beginPath();
      g.moveTo(X(x), M);
      g.lineTo(X(x), H - M);
      g.stroke();
    }
    for (let y = Math.ceil(y0 / sy) * sy; y <= y1 + 1e-9; y += sy) {
      g.beginPath();
      g.moveTo(M, Y(y));
      g.lineTo(W - M, Y(y));
      g.stroke();
    }
  }

  // Axes
  const ax = Math.min(Math.max(0, y0), y1);
  const ay = Math.min(Math.max(0, x0), x1);

  g.strokeStyle = "#0f172a";
  g.lineWidth = 3;

  // X Axis
  g.beginPath();
  g.moveTo(M, Y(ax));
  g.lineTo(W - M, Y(ax));
  g.stroke();

  // Y Axis
  g.beginPath();
  g.moveTo(X(ay), M);
  g.lineTo(X(ay), H - M);
  g.stroke();

  // Axis Labels & Ticks
  g.font = "20px sans-serif";
  g.fillStyle = "#334155";
  for (let x = Math.ceil(x0 / sx) * sx; x <= x1 + 1e-9; x += sx) {
    if (Math.abs(x) > 1e-9) {
      g.textAlign = "center";
      g.fillText(+x.toFixed(4), X(x), Y(ax) + 26);
    }
  }
  for (let y = Math.ceil(y0 / sy) * sy; y <= y1 + 1e-9; y += sy) {
    if (Math.abs(y) > 1e-9) {
      g.textAlign = "right";
      g.fillText(+y.toFixed(4), X(ay) - 10, Y(y) + 7);
    }
  }

  // Axis Names
  g.font = "italic 26px serif";
  g.fillStyle = "#000000";
  g.fillText("x", W - M + 14, Y(ax) + 8);
  g.fillText("y", X(ay) + 12, M - 10);

  // Plot Functions with distinct styles
  const colors = ["#2563eb", "#dc2626", "#16a34a", "#9333ea"];
  const dashes = [[], [12, 6], [4, 4], [16, 6, 4, 6]];

  g.save();
  g.beginPath();
  g.rect(M, M, W - 2 * M, H - 2 * M);
  g.clip();

  pts.forEach((a, k) => {
    g.strokeStyle = colors[k % colors.length];
    g.setLineDash(dashes[k % dashes.length]);
    g.lineWidth = 4;
    g.beginPath();
    let pen = false;
    let py = 0;
    a.forEach(([x, y]) => {
      if (!Number.isFinite(y)) { pen = false; return; }
      const Yy = Y(y);
      if (pen && Math.abs(Yy - py) > H * 1.5) { pen = false; }
      if (pen) g.lineTo(X(x), Yy);
      else g.moveTo(X(x), Yy);
      pen = true;
      py = Yy;
    });
    g.stroke();
  });
  g.restore();
}

["pf", "px0", "px1", "py0", "py1", "pgrid", "parrows"].forEach(id => {
  $(id).addEventListener("input", drawPlot);
});

$("p-presets").onchange = e => {
  if (e.target.value) {
    $("pf").value = e.target.value;
    drawPlot();
  }
};

$("pcl").onclick = () => $("pd").close();

$("puse").onclick = () => {
  qs[plotQ].img = {
    src: $("pc").toDataURL("image/png"),
    wmm: 75,
    nw: 1200,
    nh: 850
  };
  $("pd").close();
  renderList();
  preview();
  showToast("Plot attached to Question " + (plotQ + 1));
};

/* =========================================================================
   Storage & Project Save / Restore (Paper Library System)
   ========================================================================= */

let ready = false;
let pend = false;
let tmr = null;
let currentPaperId = null;
let libSearchTerm = "";

const Storage = {
  db: null,

  async open() {
    if (this.db) return this.db;
    return new Promise((ok, no) => {
      const r = indexedDB.open("mcq-maker-pro", 3);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains("s")) db.createObjectStore("s");
        if (!db.objectStoreNames.contains("papers")) db.createObjectStore("papers", { keyPath: "id" });
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      };
      r.onsuccess = () => { this.db = r.result; ok(this.db); };
      r.onerror = () => no(r.error);
    });
  },

  async getAllPapers() {
    try {
      const d = await this.open();
      return new Promise((ok, no) => {
        const t = d.transaction("papers", "readonly");
        const req = t.objectStore("papers").getAll();
        req.onsuccess = () => {
          const list = req.result || [];
          list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
          ok(list);
        };
        req.onerror = () => no(req.error);
      });
    } catch (e) {
      try {
        const raw = localStorage.getItem("mcq_library_fallback");
        const list = raw ? JSON.parse(raw) : [];
        list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
        return list;
      } catch (err) {
        return [];
      }
    }
  },

  async getPaper(id) {
    try {
      const d = await this.open();
      return new Promise((ok, no) => {
        const t = d.transaction("papers", "readonly");
        const req = t.objectStore("papers").get(id);
        req.onsuccess = () => ok(req.result || null);
        req.onerror = () => no(req.error);
      });
    } catch (e) {
      const all = await this.getAllPapers();
      return all.find(p => p.id === id) || null;
    }
  },

  async savePaper(paper) {
    if (!paper.id) paper.id = "paper_" + Date.now();
    paper.updatedAt = new Date().toISOString();
    try {
      const d = await this.open();
      return new Promise((ok, no) => {
        const t = d.transaction("papers", "readwrite");
        t.objectStore("papers").put(paper);
        t.oncomplete = () => ok(paper);
        t.onerror = () => no(t.error);
      });
    } catch (e) {
      const all = await this.getAllPapers();
      const idx = all.findIndex(p => p.id === paper.id);
      if (idx >= 0) all[idx] = paper;
      else all.unshift(paper);
      localStorage.setItem("mcq_library_fallback", JSON.stringify(all));
      return paper;
    }
  },

  async deletePaper(id) {
    try {
      const d = await this.open();
      return new Promise((ok, no) => {
        const t = d.transaction("papers", "readwrite");
        t.objectStore("papers").delete(id);
        t.oncomplete = () => ok();
        t.onerror = () => no(t.error);
      });
    } catch (e) {
      const all = (await this.getAllPapers()).filter(p => p.id !== id);
      localStorage.setItem("mcq_library_fallback", JSON.stringify(all));
    }
  },

  async getActiveId() {
    try {
      const d = await this.open();
      return new Promise(ok => {
        const t = d.transaction("meta", "readonly");
        const req = t.objectStore("meta").get("activeId");
        req.onsuccess = () => ok(req.result || null);
        req.onerror = () => ok(null);
      });
    } catch (e) {
      return localStorage.getItem("mcq_active_id");
    }
  },

  async setActiveId(id) {
    currentPaperId = id;
    try {
      const d = await this.open();
      const t = d.transaction("meta", "readwrite");
      t.objectStore("meta").put(id, "activeId");
    } catch (e) {
      localStorage.setItem("mcq_active_id", id);
    }
  }
};

function timeAgo(date) {
  if (!date || isNaN(date.getTime())) return "Recently";
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

async function renderLibrary() {
  const allPapers = await Storage.getAllPapers();
  const countBadge = $("lib-count-badge");
  const countLabel = $("lib-count");
  if (countBadge) countBadge.textContent = allPapers.length;
  if (countLabel) countLabel.textContent = allPapers.length;

  const activePaper = allPapers.find(p => p.id === currentPaperId);
  const activeTitleEl = $("active-paper-title-display");
  const activeMetaEl = $("active-paper-meta-display");
  if (activeTitleEl) activeTitleEl.textContent = (activePaper ? activePaper.title : S().title) || "Untitled Paper";
  if (activeMetaEl) activeMetaEl.textContent = `${qs.length} Questions • ${totalMarksCalc()} Marks • Auto-saving active`;

  const bytes = new Blob([JSON.stringify(allPapers)]).size;
  const kb = (bytes / 1024).toFixed(1);
  const usageEl = $("storage-usage-label");
  if (usageEl) {
    usageEl.textContent = `Storage: ${allPapers.length} saved papers (~${kb} KB used in Browser Storage)`;
  }

  const filtered = allPapers.filter(p => {
    if (!libSearchTerm) return true;
    const term = libSearchTerm.toLowerCase();
    return (p.title || "").toLowerCase().includes(term) || (p.subject || "").toLowerCase().includes(term);
  });

  const listEl = $("library-list");
  if (!listEl) return;

  if (!filtered.length) {
    listEl.innerHTML = allPapers.length
      ? '<div style="color:var(--mute);padding:14px;text-align:center;font-size:12px">No papers match your search.</div>'
      : '<div style="color:var(--mute);padding:14px;text-align:center;font-size:12px">No saved papers yet. Click "New Blank Paper" to start.</div>';
    return;
  }

  listEl.innerHTML = filtered.map(p => {
    const isActive = p.id === currentPaperId;
    return `
      <div class="paper-card ${isActive ? 'is-active' : ''}">
        <div class="paper-card-top">
          <span class="paper-card-title" title="${esc(p.title)}">
            ${isActive ? '<span class="active-badge">Editing</span> ' : ''}${esc(p.title || 'Untitled Paper')}
          </span>
          <span style="font-size:11px;color:var(--mute)">${timeAgo(new Date(p.updatedAt))}</span>
        </div>
        <div class="paper-card-meta">
          ${p.subject ? `<span>📘 ${esc(p.subject)}</span> •` : ''}
          ${p.grade ? `<span>🏫 ${esc(p.grade)}</span> •` : ''}
          <span>📝 ${p.qCount || 0} Qs</span> •
          <span>🎯 ${p.totalMarks || 0} Marks</span>
        </div>
        <div class="paper-card-actions">
          ${!isActive ? `<button class="btn btn-sm btn-primary" data-load-paper="${p.id}">📂 Open</button>` : ''}
          <button class="btn btn-sm" data-dup-paper="${p.id}" title="Duplicate this paper">📑 Duplicate</button>
          <button class="btn btn-sm" data-dl-paper="${p.id}" title="Download .json file">💾 JSON</button>
          ${allPapers.length > 1 ? `<button class="btn btn-sm btn-danger" data-del-paper="${p.id}" title="Delete paper">🗑️</button>` : ''}
        </div>
      </div>
    `;
  }).join("");
}

function snapshot() {
  const s = S();
  return {
    version: 3,
    qs,
    settings: s
  };
}

function applyState(d) {
  if (!d || !Array.isArray(d.qs)) return false;
  qs = d.qs.map(q => ({
    q: q.q || "",
    o: Array.isArray(q.o) ? q.o : ["", "", "", ""],
    a: q.a >= 0 && q.a < (q.o ? q.o.length : 4) ? q.a : 0,
    ol: q.ol || "",
    img: q.img || null,
    marks: Number(q.marks) || 1,
    exp: q.exp || ""
  }));

  const s = d.settings || d.s || {};
  const mapIds = [
    "inst", "title", "subject", "grade", "time", "marks", "instructions",
    "size", "or", "margin", "cols", "copies", "font", "fs", "ol", "mode"
  ];
  mapIds.forEach(id => {
    if (s[id] !== undefined && $(id)) $(id).value = s[id];
  });

  if (s.showName !== undefined) $("hdr-name").checked = !!s.showName;
  if (s.showRoll !== undefined) $("hdr-roll").checked = !!s.showRoll;
  if (s.showSec !== undefined) $("hdr-sec").checked = !!s.showSec;
  if (s.showDate !== undefined) $("hdr-date").checked = !!s.showDate;
  if (s.keyMode !== undefined) $("key-mode").value = s.keyMode;
  else if (s.key !== undefined) $("key-mode").value = s.key ? "end" : "none";
  // Sync mirror dropdowns
  const km = $("key-mode").value;
  if ($("top-key-mode")) $("top-key-mode").value = km;
  if ($("key-mode-export")) $("key-mode-export").value = km;
  if (s.showOMR !== undefined) $("show-omr").checked = !!s.showOMR;

  return true;
}

async function saveNow() {
  clearTimeout(tmr);
  try {
    const snap = snapshot();
    if (!currentPaperId) {
      currentPaperId = "paper_" + Date.now();
      await Storage.setActiveId(currentPaperId);
    }
    const record = {
      id: currentPaperId,
      title: S().title || "Untitled Paper",
      subject: S().subject || "",
      grade: S().grade || "",
      qCount: qs.length,
      totalMarks: totalMarksCalc(),
      updatedAt: new Date().toISOString(),
      data: snap
    };
    await Storage.savePaper(record);

    pend = false;
    $("sv").textContent = `Auto-saved "${record.title}" at ` + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    renderLibrary();
  } catch (e) {
    $("sv").textContent = "Auto-save ready.";
  }
}

function queueSave() {
  if (!ready) return;
  pend = true;
  $("sv").textContent = "Saving...";
  clearTimeout(tmr);
  tmr = setTimeout(saveNow, 600);
}

// Storage UI Event Handlers
$("btn-new-paper").onclick = async () => {
  const newId = "paper_" + Date.now();
  const newPaper = {
    id: newId,
    title: "New MCQ Paper",
    subject: "",
    grade: "",
    qCount: 1,
    totalMarks: 1,
    updatedAt: new Date().toISOString(),
    data: {
      qs: [{ q: "", o: ["", "", "", ""], a: 0, ol: "", marks: 1, exp: "" }],
      settings: { ...S(), title: "New MCQ Paper", subject: "", grade: "", time: "", marks: "Auto", instructions: "Select the correct option for each question." }
    }
  };
  await Storage.savePaper(newPaper);
  await Storage.setActiveId(newId);
  applyState(newPaper.data);
  renderList();
  preview();
  renderLibrary();
  showToast("Created new paper!");
};

$("btn-save-as-copy").onclick = async () => {
  const defTitle = (S().title || "MCQ Paper") + " (Copy)";
  const newTitle = prompt("Enter title for new copy:", defTitle);
  if (!newTitle) return;
  const newId = "paper_" + Date.now();
  const snap = snapshot();
  snap.settings.title = newTitle;
  $("title").value = newTitle;
  const clone = {
    id: newId,
    title: newTitle,
    subject: S().subject || "",
    grade: S().grade || "",
    qCount: qs.length,
    totalMarks: totalMarksCalc(),
    updatedAt: new Date().toISOString(),
    data: snap
  };
  await Storage.savePaper(clone);
  await Storage.setActiveId(newId);
  preview();
  renderLibrary();
  showToast(`Saved copy: "${newTitle}"`);
};

if ($("btn-quick-library")) {
  $("btn-quick-library").onclick = () => {
    const libTabBtn = document.querySelector('.tab-btn[data-tab="library"]');
    if (libTabBtn) libTabBtn.click();
  };
}

$("lib-search").addEventListener("input", e => {
  libSearchTerm = e.target.value.trim();
  renderLibrary();
});

$("library-list").addEventListener("click", async e => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const d = btn.dataset;

  if (d.loadPaper) {
    const p = await Storage.getPaper(d.loadPaper);
    if (p) {
      await saveNow();
      await Storage.setActiveId(p.id);
      applyState(p.data);
      renderList();
      preview();
      renderLibrary();
      showToast(`Opened "${p.title}"`);
    }
  } else if (d.dupPaper) {
    const p = await Storage.getPaper(d.dupPaper);
    if (p) {
      const cloneId = "paper_" + Date.now();
      const cloneTitle = (p.title || "Paper") + " (Copy)";
      const cloneData = JSON.parse(JSON.stringify(p.data));
      if (cloneData.settings) cloneData.settings.title = cloneTitle;
      const clone = {
        ...p,
        id: cloneId,
        title: cloneTitle,
        updatedAt: new Date().toISOString(),
        data: cloneData
      };
      await Storage.savePaper(clone);
      renderLibrary();
      showToast(`Duplicated "${p.title}"`);
    }
  } else if (d.dlPaper) {
    const p = await Storage.getPaper(d.dlPaper);
    if (p) {
      const b = new Blob([JSON.stringify(p.data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = (p.title || "mcq_exam").replace(/[^\w-]+/g, "_") + ".mcq.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
  } else if (d.delPaper) {
    const p = await Storage.getPaper(d.delPaper);
    if (!p) return;
    if (confirm(`Are you sure you want to delete "${p.title}" from storage?`)) {
      await Storage.deletePaper(p.id);
      if (currentPaperId === p.id) {
        const remaining = await Storage.getAllPapers();
        if (remaining.length) {
          await Storage.setActiveId(remaining[0].id);
          applyState(remaining[0].data);
          renderList();
          preview();
        } else {
          $("btn-new-paper").click();
        }
      }
      renderLibrary();
      showToast(`Deleted "${p.title}"`);
    }
  }
});

$("btn-backup-library").onclick = async () => {
  const all = await Storage.getAllPapers();
  const backup = {
    app: "MCQ Paper Maker Pro",
    version: 3,
    exportedAt: new Date().toISOString(),
    papers: all
  };
  const b = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = `mcq_all_papers_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  showToast(`Exported all ${all.length} papers to backup file!`);
};

$("input-restore-library").onchange = e => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = async () => {
    try {
      const parsed = JSON.parse(r.result);
      const papers = Array.isArray(parsed.papers) ? parsed.papers : (Array.isArray(parsed) ? parsed : null);
      if (!papers || !papers.length) throw new Error("No papers found in backup");
      for (const p of papers) {
        if (p.id && p.title && p.data) {
          await Storage.savePaper(p);
        }
      }
      renderLibrary();
      showToast(`Successfully restored ${papers.length} papers!`);
    } catch (err) {
      alert("Invalid backup file: " + err.message);
    }
  };
  r.readAsText(f);
  e.target.value = "";
};

$("psave").onclick = () => {
  const b = new Blob([JSON.stringify(snapshot(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = (S().title || "mcq_exam").replace(/[^\w-]+/g, "_") + ".mcq.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  showToast("Project saved to file!");
};

$("popen").onchange = e => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = async () => {
    try {
      const parsed = JSON.parse(r.result);
      if (!applyState(parsed)) throw 0;
      const newId = "paper_" + Date.now();
      const newTitle = (parsed.settings && parsed.settings.title) || f.name.replace(/\.mcq\.json$/i, "");
      const newRecord = {
        id: newId,
        title: newTitle,
        subject: (parsed.settings && parsed.settings.subject) || "",
        grade: (parsed.settings && parsed.settings.grade) || "",
        qCount: qs.length,
        totalMarks: totalMarksCalc(),
        updatedAt: new Date().toISOString(),
        data: parsed
      };
      await Storage.savePaper(newRecord);
      await Storage.setActiveId(newId);
      renderList();
      preview();
      renderLibrary();
      showToast("Project file imported into library!");
    } catch (err) {
      alert("This file is not a valid MCQ Maker project file.");
    }
  };
  r.readAsText(f);
  e.target.value = "";
};

// Keyboard Shortcuts
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "p") {
    e.preventDefault();
    preview();
    window.print();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    saveNow();
    showToast("Saved to library!");
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "A" || e.key === "a")) {
    e.preventDefault();
    $("add").click();
  }
});

// App Initialization
(async () => {
  try {
    await Storage.open();
    let allPapers = await Storage.getAllPapers();
    let activeId = await Storage.getActiveId();

    if (!allPapers.length) {
      const initialRecord = {
        id: "paper_" + Date.now(),
        title: $("title").value || "Sample Exam Paper",
        subject: $("subject").value || "Mathematics",
        grade: $("grade").value || "Grade 10",
        qCount: qs.length,
        totalMarks: totalMarksCalc(),
        updatedAt: new Date().toISOString(),
        data: snapshot()
      };
      await Storage.savePaper(initialRecord);
      allPapers = [initialRecord];
      activeId = initialRecord.id;
    }

    const activePaper = allPapers.find(p => p.id === activeId) || allPapers[0];
    await Storage.setActiveId(activePaper.id);
    if (activePaper.data) {
      applyState(activePaper.data);
      $("sv").textContent = `Loaded "${activePaper.title}".`;
    }
  } catch (e) {
    $("sv").textContent = "Storage ready.";
  }
  ready = true;
  renderList();
  preview();
  renderLibrary();

  // If MathJax takes longer to load, re-render preview when ready
  if (window.MathJax && MathJax.startup && MathJax.startup.promise) {
    MathJax.startup.promise.then(() => {
      preview();
    });
  }
})();

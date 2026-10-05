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
    .replace(/~([^~]+?)~/g, '<sub>$1</sub>')
    .replace(/\^([^\^]+?)\^/g, '<sup>$1</sup>')
    .replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>')
    // nth root: ⁿ√(...) — must come before cube and square root
    .replace(/ⁿ√\(([^)]*)\)/g, '<span class="math-root nrt"><span class="root-index">n</span><span class="root-radical">&#x221A;</span><span class="root-body">$1</span></span>')
    // cube root: ∛(...)
    .replace(/∛\(([^)]*)\)/g, '<span class="math-root cbrt"><span class="root-index">3</span><span class="root-radical">&#x221A;</span><span class="root-body">$1</span></span>')
    // square root: √(...)
    .replace(/√\(([^)]*)\)/g, '<span class="math-root sqrt"><span class="root-radical">&#x221A;</span><span class="root-body">$1</span></span>')
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
            <button class="btn btn-sm" data-shape="${i}">📐 Shapes</button>
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
  } else if (d.shape !== undefined) {
    openShapesModal(+d.shape);
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
    ["x²", "²", "^{2}"], ["x³", "³", "^{3}"], ["x⁴", "⁴", "^{4}"],
    ["xⁿ", "^^", "^{n}", 1], ["xˣ", "^^", "^{x}", 1], ["x⁺", "^^", "^{+}", 1], ["x⁻", "^^", "^{-}", 1],
    ["x₀", "₀", "_{0}"], ["x₁", "₁", "_{1}"], ["x₂", "₂", "_{2}"], ["x₃", "₃", "_{3}"],
    ["xₙ", "~~", "_{n}", 1], ["xᵢ", "~~", "_{i}", 1],
    ["√x", "√()", "\\sqrt{x}", 2], ["∛x", "∛()", "\\sqrt[3]{x}", 2], ["ⁿ√x", "ⁿ√()", "\\sqrt[n]{x}", 3],
    ["|x|", "|x|", "\\left|x\\right|"],
    ["( )", "( )", "\\left( \\right)"], ["[ ]", "[ ]", "\\left[ \\right]"], ["{ }", "{ }", "\\left\\{ \\right\\}"],
    ["x̄", "x̄", "\\bar{x}"], ["x̂", "x̂", "\\hat{x}"]
  ],
  sym: [
    ["±", "±", "\\pm"], ["∓", "∓", "\\mp"], ["×", "×", "\\times"], ["÷", "÷", "\\div"],
    ["·", "·", "\\cdot"], ["=", "=", "="], ["≠", "≠", "\\neq"], ["≈", "≈", "\\approx"],
    ["<", "<", "<"], [">", ">", ">"], ["≤", "≤", "\\leq"], ["≥", "≥", "\\geq"],
    ["≡", "≡", "\\equiv"], ["∝", "∝", "\\propto"], ["∞", "∞", "\\infty"],
    ["%", "%", "\\%"], ["‰", "‰", "\\permil"], ["∗", "∗", "\\ast"]
  ],
  frac: [
    ["½", "½", "\\frac{1}{2}"], ["⅓", "⅓", "\\frac{1}{3}"], ["⅔", "⅔", "\\frac{2}{3}"],
    ["¼", "¼", "\\frac{1}{4}"], ["¾", "¾", "\\frac{3}{4}"], ["⅕", "⅕", "\\frac{1}{5}"],
    ["⅖", "⅖", "\\frac{2}{5}"], ["⅗", "⅗", "\\frac{3}{5}"], ["⅘", "⅘", "\\frac{4}{5}"],
    ["⅙", "⅙", "\\frac{1}{6}"], ["⅚", "⅚", "\\frac{5}{6}"],
    ["⅛", "⅛", "\\frac{1}{8}"], ["⅜", "⅜", "\\frac{3}{8}"], ["⅝", "⅝", "\\frac{5}{8}"], ["⅞", "⅞", "\\frac{7}{8}"],
    ["a/b", "a/b", "\\frac{a}{b}"], ["a:b", "a:b", "a:b"]
  ],
  geo: [
    ["°", "°", "^\\circ"], ["′", "′", "'"], ["″", "″", "''"],
    ["∠", "∠", "\\angle"], ["△", "△", "\\triangle"], ["⊥", "⊥", "\\perp"],
    ["∥", "∥", "\\parallel"], ["≅", "≅", "\\cong"], ["∼", "∼", "\\sim"],
    ["π", "π", "\\pi"], ["⌒", "⌒", "\\frown"], ["⊙", "⊙", "\\odot"],
    ["cm²", "cm²", "\\text{ cm}^2"], ["m²", "m²", "\\text{ m}^2"], ["m³", "m³", "\\text{ m}^3"],
    ["m/s", "m/s", "\\text{ m/s}"], ["m/s²", "m/s²", "\\text{ m/s}^2"], ["km/h", "km/h", "\\text{ km/h}"],
    ["℃", "℃", "^\\circ\\text{C}"], ["℉", "℉", "^\\circ\\text{F}"]
  ],
  greek: [
    ["α", "α", "\\alpha"], ["β", "β", "\\beta"], ["γ", "γ", "\\gamma"], ["δ", "δ", "\\delta"],
    ["ε", "ε", "\\epsilon"], ["θ", "θ", "\\theta"], ["λ", "λ", "\\lambda"], ["μ", "μ", "\\mu"],
    ["π", "π", "\\pi"], ["ρ", "ρ", "\\rho"], ["σ", "σ", "\\sigma"], ["τ", "τ", "\\tau"],
    ["φ", "φ", "\\phi"], ["ω", "ω", "\\omega"],
    ["Δ", "Δ", "\\Delta"], ["Θ", "Θ", "\\Theta"], ["Λ", "Λ", "\\Lambda"],
    ["Σ", "Σ", "\\Sigma"], ["Φ", "Φ", "\\Phi"], ["Ω", "Ω", "\\Omega"]
  ],
  sets: [
    ["∈", "∈", "\\in"], ["∉", "∉", "\\notin"], ["⊂", "⊂", "\\subset"], ["⊃", "⊃", "\\supset"],
    ["⊆", "⊆", "\\subseteq"], ["⊇", "⊇", "\\supseteq"],
    ["∪", "∪", "\\cup"], ["∩", "∩", "\\cap"], ["∅", "∅", "\\emptyset"], ["U", "U", "U"],
    ["∀", "∀", "\\forall"], ["∃", "∃", "\\exists"], ["∴", "∴", "\\therefore"], ["∵", "∵", "\\because"],
    ["⇒", "⇒", "\\Rightarrow"], ["⇔", "⇔", "\\Leftrightarrow"]
  ],
  calc: [
    ["∫", "∫", "\\int"], ["∬", "∬", "\\iint"], ["∮", "∮", "\\oint"],
    ["∑", "∑", "\\sum"], ["∏", "∏", "\\prod"],
    ["∂", "∂", "\\partial"], ["∇", "∇", "\\nabla"],
    ["lim", "lim", "\\lim_{x\\to 0}"], ["dy/dx", "dy/dx", "\\frac{dy}{dx}"],
    ["dx", "dx", "dx"], ["dt", "dt", "dt"],
    ["f(x)", "f(x)", "f(x)"], ["f'(x)", "f'(x)", "f'(x)"]
  ],
  sci: [
    ["→", "→", "\\to"], ["←", "←", "\\leftarrow"], ["⇌", "⇌", "\\rightleftharpoons"],
    ["↑", "↑", "\\uparrow"], ["↓", "↓", "\\downarrow"], ["⇄", "⇄", "\\leftrightarrow"],
    ["v⃗", "v⃗", "\\vec{v}"], ["F⃗", "F⃗", "\\vec{F}"], ["a⃗", "a⃗", "\\vec{a}"],
    ["ΔH", "ΔH", "\\Delta H"], ["mol", "mol", "\\text{ mol}"], ["Hz", "Hz", "\\text{ Hz}"],
    ["Ω", "Ω", "\\Omega"], ["Å", "Å", "\\text{Å}"], ["μm", "μm", "\\mu\\text{m}"]
  ]
};

let activePalette = "alg";
let paletteMode = "word"; // 'word' (Word-style natural symbols) | 'latex' ($...$)

function renderPalette() {
  const syms = PALETTES[activePalette] || [];
  $("tb").innerHTML = syms.map(([lbl, wordVal, texVal, cursorOffset]) => {
    const val = paletteMode === "word" ? wordVal : (texVal || wordVal);
    const title = paletteMode === "word" ? `Insert symbol: ${wordVal}` : `Insert LaTeX: ${texVal || wordVal}`;
    const cur = (paletteMode === "word" && cursorOffset) ? ` data-cursor="${cursorOffset}"` : "";
    return `<button class="math-sym-btn" data-val="${esc(val)}"${cur} title="${esc(title)}">${lbl}</button>`;
  }).join("");
}
renderPalette();

if ($("btn-mode-word")) {
  $("btn-mode-word").onclick = () => {
    paletteMode = "word";
    $("btn-mode-word").classList.add("active");
    if ($("btn-mode-latex")) $("btn-mode-latex").classList.remove("active");
    renderPalette();
  };
}
if ($("btn-mode-latex")) {
  $("btn-mode-latex").onclick = () => {
    paletteMode = "latex";
    $("btn-mode-latex").classList.add("active");
    if ($("btn-mode-word")) $("btn-mode-word").classList.remove("active");
    renderPalette();
  };
}

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
  const cursor = +btn.dataset.cursor || 0;
  const f = lastFocusedField;
  const p1 = f.selectionStart;
  const p2 = f.selectionEnd;
  const v = f.value;

  let insertText = sn;
  if (paletteMode === "latex") {
    const insideMath = (v.slice(0, p1).match(/\$/g) || []).length % 2 === 1;
    insertText = insideMath ? sn : `$${sn}$`;
  }

  f.value = v.slice(0, p1) + insertText + v.slice(p2);
  f.focus();
  const newPos = cursor ? p1 + cursor : p1 + insertText.length;
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
  const items = qs.map((q, i) => `
    <span class="key-compact-item"><b>${i + 1}.</b> (${L[q.a]})</span>
  `).join("");
  return `
    <div class="key-box">
      <div class="key-box-title">ANSWER KEY:</div>
      <div class="key-compact-items">${items}</div>
    </div>
  `;
}

function keyTableHTML(s) {
  if (!qs.length) return "";
  s = s && typeof s === "object" ? s : S();
  const calculatedMarks = totalMarksCalc();
  const fullMarksText = s.marks && s.marks.toLowerCase() !== "auto" ? s.marks : calculatedMarks + " Marks";

  // Quick Answer Matrix: 10 questions per row
  const CHUNK_SIZE = 10;
  let matrixRows = "";
  for (let i = 0; i < qs.length; i += CHUNK_SIZE) {
    const chunk = qs.slice(i, i + CHUNK_SIZE);
    matrixRows += `
      <table class="ak-matrix-table">
        <tr>${chunk.map((q, idx) => `<th>Q${i + idx + 1}</th>`).join("")}</tr>
        <tr class="ak-ans-row">${chunk.map(q => `<td><b>${L[q.a]}</b></td>`).join("")}</tr>
      </table>
    `;
  }

  // Detailed Solutions and Explanations
  let solHtml = "";
  if (s.keyExpl) {
    const cards = qs.map((q, i) => {
      const correctText = q.o && q.o[q.a] ? rich(q.o[q.a], 1) : "";
      const expl = q.exp ? rich(q.exp) : "";
      const marksVal = Number(q.marks) || 1;
      return `
        <div class="ak-sol-card">
          <div class="ak-sol-header">
            <span><b>${i + 1}.</b> ${rich(q.q)}</span>
            <span class="ak-sol-marks">[${marksVal} Mark${marksVal > 1 ? 's' : ''}]</span>
          </div>
          <div class="ak-sol-correct">
            <span>✓ Correct Answer:</span> <b>Option (${L[q.a]})</b> ${correctText ? `— ${correctText}` : ""}
          </div>
          ${expl ? `<div class="ak-sol-expl"><b>Solution / Explanation:</b><br>${expl}</div>` : ""}
        </div>
      `;
    }).join("");

    if (cards) {
      solHtml = `
        <div class="ak-section-title">Detailed Solutions &amp; Explanations</div>
        <div class="ak-solutions-list">${cards}</div>
      `;
    }
  }

  return `
    <div class="ak-container">
      <div class="ak-header">
        ${s.inst ? `<div class="ak-inst">${esc(s.inst)}</div>` : ""}
        <div class="ak-title">${esc(s.title || "Examination")}</div>
        <div class="ak-badge-row">
          <span class="ak-badge">OFFICIAL ANSWER KEY &amp; SOLUTIONS</span>
        </div>
        <div class="ak-meta-grid">
          ${s.subject ? `<span><b>Subject:</b> ${esc(s.subject)}</span>` : ""}
          ${s.grade ? `<span><b>Class/Grade:</b> ${esc(s.grade)}</span>` : ""}
          ${s.time ? `<span><b>Time:</b> ${esc(s.time)}</span>` : ""}
          <span><b>Total Questions:</b> ${qs.length}</span>
          <span><b>Full Marks:</b> ${esc(fullMarksText)}</span>
        </div>
      </div>

      <div class="ak-section-title">Quick Answer Key Matrix</div>
      <div class="ak-matrix-wrapper">
        ${matrixRows}
      </div>

      ${solHtml}

      <div class="ak-footer">
        <span><b>Evaluator Signature:</b> _________________________</span>
        <span><b>Date of Verification:</b> _________________</span>
        <span><b>Total Evaluated:</b> ${qs.length} Questions</span>
      </div>
    </div>
  `;
}

function omrSheetHTML(s) {
  const qList = qs.length ? qs : Array(20).fill(null);
  const qCount = qList.length;

  // Determine max options across questions (min 4, max 6)
  const maxOpts = Math.max(4, Math.min(6, Math.max(...qList.map(q => q && q.o ? q.o.length : 4))));
  const optLetters = L.slice(0, maxOpts);

  // Determine optimal column count based on question count
  let cols = 4;
  if (qCount <= 12) cols = 1;
  else if (qCount <= 25) cols = 2;
  else if (qCount <= 50) cols = 3;
  else if (qCount <= 80) cols = 4;
  else cols = 5;

  const perCol = Math.ceil(qCount / cols);

  let colHtml = "";
  for (let c = 0; c < cols; c++) {
    let rowsHtml = "";
    for (let r = 0; r < perCol; r++) {
      const idx = c * perCol + r;
      if (idx >= qCount) break;
      const num = String(idx + 1).padStart(2, "0");
      const isBlockEnd = (idx + 1) % 5 === 0 && (r + 1 < perCol) && (idx + 1 < qCount);
      const isAltBlock = Math.floor(idx / 5) % 2 === 1;

      const bubbles = optLetters.map(letter => `
        <span class="omr-bubble" title="Option ${letter}">${letter}</span>
      `).join("");

      rowsHtml += `
        <div class="omr-q-row ${isAltBlock ? 'omr-row-alt' : ''} ${isBlockEnd ? 'omr-block-end' : ''}">
          <span class="omr-q-num">${num}</span>
          <div class="omr-bubbles-group">
            ${bubbles}
          </div>
        </div>
      `;
    }

    const headerBubbles = optLetters.map(l => `<span class="omr-hdr-bubble">${l}</span>`).join("");

    colHtml += `
      <div class="omr-col-block">
        <div class="omr-col-hdr">
          <span class="omr-hdr-num">Q.NO</span>
          <div class="omr-hdr-bubbles">${headerBubbles}</div>
        </div>
        <div class="omr-col-rows">
          ${rowsHtml}
        </div>
      </div>
    `;
  }

  // Generate Roll Number 0-9 Grid (6 digits)
  const numDigits = 6;
  const rollBoxes = Array(numDigits).fill('<div class="omr-roll-box"></div>').join("");
  let rollGridRows = "";
  for (let d = 0; d <= 9; d++) {
    const digitBubbles = Array(numDigits).fill(`<span class="omr-bubble sm">${d}</span>`).join("");
    rollGridRows += `
      <div class="omr-roll-row">
        <span class="omr-digit-lbl">${d}</span>
        ${digitBubbles}
      </div>
    `;
  }

  // Set Code bubbles (A, B, C, D)
  const setBubbles = ["A", "B", "C", "D"].map(set => `
    <div class="omr-set-item">
      <span class="omr-bubble sm">${set}</span>
      <span class="omr-set-lbl">Set ${set}</span>
    </div>
  `).join("");

  return `
    <div class="omr-sheet-wrapper">
      <!-- Corner Fiducial Marks (Optical Alignment) -->
      <div class="omr-fiducial omr-fid-tl"></div>
      <div class="omr-fiducial omr-fid-tr"></div>
      <div class="omr-fiducial omr-fid-bl"></div>
      <div class="omr-fiducial omr-fid-br"></div>

      <!-- Main OMR Content Container -->
      <div class="omr-main-container">
        
        <!-- Top Exam Header -->
        <div class="omr-exam-header">
          <div class="omr-inst-title">${esc(s.inst ? s.inst.toUpperCase() : "EXAMINATION BOARD / INSTITUTION")}</div>
          <div class="omr-exam-title">${esc(s.title ? s.title.toUpperCase() : "MULTIPLE CHOICE QUESTION EXAMINATION")}</div>
          <div class="omr-sheet-badge">★ OMR RESPONSE &amp; EVALUATION SHEET ★</div>
          
          <div class="omr-meta-strip">
            <span><b>SUBJECT:</b> ${esc(s.subject || "General")}</span>
            <span><b>CLASS/GRADE:</b> ${esc(s.grade || "-")}</span>
            <span><b>DATE:</b> ___________</span>
            <span><b>MAX MARKS:</b> ${esc(s.marks && s.marks.toLowerCase() !== "auto" ? s.marks : totalMarksCalc())}</span>
          </div>
        </div>

        <!-- Upper Grid: Candidate Details, Roll No Matrix, Set Code & Signatures -->
        <div class="omr-top-grid">
          
          <!-- Box 1: Candidate Particulars & Signatures -->
          <div class="omr-box omr-cand-box">
            <div class="omr-box-title">1. CANDIDATE PARTICULARS</div>
            <div class="omr-cand-fields">
              <div class="omr-field-line">
                <span class="omr-lbl">Candidate Name:</span>
                <span class="omr-line"></span>
              </div>
              <div class="omr-field-line">
                <span class="omr-lbl">Father's/Guardian's Name:</span>
                <span class="omr-line"></span>
              </div>
              <div class="omr-cand-row">
                <div class="omr-field-line" style="flex:1">
                  <span class="omr-lbl">Roll No (Words):</span>
                  <span class="omr-line"></span>
                </div>
                <div class="omr-field-line" style="width:100px">
                  <span class="omr-lbl">Room No:</span>
                  <span class="omr-line"></span>
                </div>
              </div>
            </div>

            <div class="omr-signatures-grid">
              <div class="omr-sig-box">
                <div class="omr-sig-space"></div>
                <div class="omr-sig-label">Signature of Candidate</div>
              </div>
              <div class="omr-sig-box">
                <div class="omr-sig-space"></div>
                <div class="omr-sig-label">Signature of Invigilator</div>
              </div>
            </div>
          </div>

          <!-- Box 2: Roll Number / Candidate ID with 0-9 Matrix -->
          <div class="omr-box omr-roll-box-container">
            <div class="omr-box-title">2. ROLL NUMBER / ID</div>
            <div class="omr-roll-write-row">
              <span style="width:12px"></span>
              ${rollBoxes}
            </div>
            <div class="omr-roll-matrix">
              ${rollGridRows}
            </div>
          </div>

          <!-- Box 3: Test Booklet Set Code -->
          <div class="omr-box omr-set-box-container">
            <div class="omr-box-title">3. TEST SET</div>
            <div class="omr-set-sub">Booklet Code</div>
            <div class="omr-set-grid">
              ${setBubbles}
            </div>
            <div class="omr-eval-box">
              <div class="omr-eval-title">OFFICIAL SCORE</div>
              <div class="omr-eval-marks">Score: _____</div>
            </div>
          </div>

        </div>

        <!-- Instructions Ribbon -->
        <div class="omr-instructions-ribbon">
          <div class="omr-inst-left">
            <span class="omr-inst-tag">INSTRUCTIONS</span>
            <span>• Use <b>Blue / Black Ballpoint Pen</b> only.</span>
            <span>• Darken circles <b>completely</b>.</span>
            <span>• Do not fold or make stray marks.</span>
          </div>
          <div class="omr-inst-examples">
            <div class="omr-ex-item"><span class="omr-ex-lbl">CORRECT:</span> <span class="omr-bubble sm filled">A</span></div>
            <div class="omr-ex-item"><span class="omr-ex-lbl">WRONG:</span> <span class="omr-bubble sm strike">✓</span> <span class="omr-bubble sm strike">✕</span> <span class="omr-bubble sm strike">◐</span></div>
          </div>
        </div>

        <!-- Main Answer Bubble Response Grid -->
        <div class="omr-responses-container">
          <div class="omr-responses-title">4. CANDIDATE RESPONSES (DARKEN THE APPROPRIATE CIRCLE FOR EACH QUESTION)</div>
          <div class="omr-questions-grid omr-cols-${cols}">
            ${colHtml}
          </div>
        </div>

        <!-- Footer / Timing Marks -->
        <div class="omr-footer-bar">
          <div class="omr-timing-bar">
            ${Array(34).fill('<span class="omr-timing-tick"></span>').join("")}
          </div>
          <div class="omr-footer-text">
            <span>MCQ PAPER MAKER PRO — STANDARDIZED OMR SCANNER SHEET</span>
            <span>DO NOT CREASE OR BEND THIS PAGE</span>
          </div>
        </div>

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
  if (tag) {
    tag.textContent = isTeacher ? "👨‍🏫 Teacher Master Copy" : "🎓 Student Copy";
    tag.style.background = isTeacher ? "var(--success)" : "rgba(255,255,255,0.1)";
  }
  if ($("btn-quick-toggle")) {
    const iconEl = $("mode-fab-icon");
    const labelEl = $("mode-fab-label");
    if (iconEl && labelEl) {
      iconEl.textContent = isTeacher ? "👨‍🏫" : "🎓";
      labelEl.textContent = isTeacher ? "Teacher View" : "Student View";
    } else {
      $("btn-quick-toggle").innerHTML = isTeacher
        ? `<span class="mode-fab-icon" id="mode-fab-icon">👨‍🏫</span><span class="mode-fab-label" id="mode-fab-label">Teacher View</span>`
        : `<span class="mode-fab-icon" id="mode-fab-icon">🎓</span><span class="mode-fab-label" id="mode-fab-label">Student View</span>`;
    }
  }

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
    const padTop = Math.max(12, mg.top);
    const padSide = Math.max(14, mg.side);
    const padBot = Math.max(12, mg.bot);
    sh.style.cssText = `width:${w}mm;height:${h}mm;padding:${padTop}mm ${padSide}mm ${padBot}mm;font-family:${s.font};font-size:${s.fs}pt;box-sizing:border-box`;
    sh.innerHTML = keyTableHTML(s);
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
      .cut-v, .cut-h, .cut-label,
      .preview-mode-fab,
      .preview-print-fab,
      .zoom-fab,
      .pl,
      .preview-toolbar,
      .status-bar,
      .noprint,
      aside {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
      }
    }
  `;

  if ($("page-count-badge")) {
    $("page-count-badge").textContent = `${sheets.length} Page${sheets.length > 1 ? 's' : ''}`;
  }
  queueSave();
}

function applyZoom(sheets, w, h) {
  const scrollEl = $("wrap") ? $("wrap").parentElement : null;
  const containerW = (scrollEl ? scrollEl.clientWidth : window.innerWidth) - 32;
  const containerH = (scrollEl ? scrollEl.clientHeight : window.innerHeight) - 40;
  const scaleW = containerW / (w * 3.7795);
  const scaleH = containerH / (h * 3.7795);
  const baseScale = Math.min(scaleW, scaleH);

  let z = 1;
  if (currentZoom === "fit") {
    z = Math.min(1.25, Math.max(0.35, baseScale));
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

      if (sheets.length > 1) {
        const pl = document.createElement("div");
        pl.className = "pl noprint";
        pl.textContent = `Page ${i + 1} of ${sheets.length}`;
        sw.insertBefore(pl, sh);
      }
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

/* =========================================================================
   PDF Auto-Download — html2canvas + jsPDF (page-by-page capture)
   ========================================================================= */

async function downloadPDF() {
  preview();
  const s = S();

  const sizeMap = {
    A4: [210, 297], A3: [297, 420], A5: [148, 210],
    Letter: [215.9, 279.4], Legal: [215.9, 355.6]
  };
  const [w, h] = sizeMap[s.size] || [210, 297];
  const isLandscape = s.or === "l";
  const pdfW = isLandscape ? h : w;
  const pdfH = isLandscape ? w : h;

  const safeTitle = (s.title || "Exam").replace(/[^a-zA-Z0-9\s\-_]/g, "").trim().replace(/\s+/g, "_") || "Exam";
  const modeLabel = s.mode === "teacher" ? "AnswerKey" : "StudentCopy";
  const filename = safeTitle + "_" + modeLabel + ".pdf";

  const fab = $("btn-top-print");
  const bpdfBtn = $("bpdf");
  if (fab) { fab.style.opacity = "0.45"; fab.style.pointerEvents = "none"; }
  if (bpdfBtn) { bpdfBtn.disabled = true; bpdfBtn.textContent = "\u23f3 Generating\u2026"; }

  try {
    if (typeof html2pdf === "undefined") throw new Error("html2pdf not loaded");

    const sheets = Array.from($("wrap").querySelectorAll(".sheet"));
    if (!sheets.length) throw new Error("No sheets to export");

    // Step 1: Save transforms and wrapper sizes, then reset to 1:1
    const savedSh = sheets.map(sh => sh.style.transform);
    const wrappers = sheets.map(sh => sh.closest(".sw") || sh.parentElement);
    const savedSw = wrappers.map(sw => ({ w: sw.style.width, h: sw.style.height, ov: sw.style.overflow }));

    const pxW = Math.round(pdfW * 3.7795);
    const pxH = Math.round(pdfH * 3.7795);

    sheets.forEach(sh => { sh.style.transform = "scale(1)"; sh.style.transformOrigin = "top left"; });
    wrappers.forEach(sw => {
      sw.style.width = pdfW + "mm";
      sw.style.height = pdfH + "mm";
      sw.style.overflow = "visible";
    });

    // Step 2: Wait for layout to apply
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    // Step 3: Capture each sheet with html2canvas
    const h2c = window.html2canvas || (typeof html2canvas !== "undefined" ? html2canvas : null);
    if (!h2c) throw new Error("html2canvas not available");

    const canvases = [];
    for (const sh of sheets) {
      const c = await h2c(sh, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: pxW,
        height: pxH,
        scrollX: 0,
        scrollY: 0
      });
      canvases.push(c);
    }

    // Step 4: Restore original transforms and wrapper sizes
    sheets.forEach((sh, i) => { sh.style.transform = savedSh[i]; });
    wrappers.forEach((sw, i) => { sw.style.width = savedSw[i].w; sw.style.height = savedSw[i].h; sw.style.overflow = savedSw[i].ov; });

    // Step 5: Build PDF using jsPDF
    const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPDFCtor) throw new Error("jsPDF not available");

    const orient = isLandscape ? "landscape" : "portrait";
    const pdf = new jsPDFCtor({ unit: "mm", format: [pdfW, pdfH], orientation: orient });

    canvases.forEach((canvas, i) => {
      if (i > 0) pdf.addPage([pdfW, pdfH], orient);
      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);
    });

    pdf.save(filename);

  } catch (err) {
    console.error("PDF generation failed:", err);
    alert("PDF auto-download failed: " + err.message + "\nOpening print dialog instead.");
    window.print();
  } finally {
    if (fab) { fab.style.opacity = ""; fab.style.pointerEvents = ""; }
    if (bpdfBtn) { bpdfBtn.disabled = false; bpdfBtn.textContent = "\ud83d\udcbe Save as PDF"; }
  }
}

$("bprint").onclick = () => { preview(); window.print(); };
$("bpdf").onclick = () => downloadPDF();
$("btn-top-print").onclick = () => downloadPDF();

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
  // If local bundle didn't load, try CDN on demand
  if (!window.docx) {
    const btn2 = $("bdoc");
    btn2.disabled = true;
    btn2.textContent = "Loading library...";
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js';
      s.onload = res;
      s.onerror = () => rej(new Error('Failed to load DOCX library. Please check your internet connection.'));
      document.head.appendChild(s);
    }).catch(err => { alert(err.message); btn2.disabled = false; btn2.textContent = "📄 Word (.docx)"; throw err; });
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

/* Shapes / Diagrams Studio Integration */
let shapeQ = 0;

function openShapesModal(qIndex) {
  shapeQ = qIndex;
  const title = $("shapes-modal-title");
  if (title) title.textContent = `📐 Insert Diagram into Question ${shapeQ + 1}`;
  $("modal-shapes").showModal();
}

if ($("btn-close-shapes")) $("btn-close-shapes").onclick = () => $("modal-shapes").close();

function setShapesTab(toolId, src) {
  ["tab-shapes-geo", "tab-shapes-venn", "tab-shapes-optics"].forEach(id => {
    const btn = $(id);
    if (!btn) return;
    if (id === toolId) {
      btn.style.background = "#ffffff";
      btn.style.boxShadow = "0 1px 2px rgba(0,0,0,0.06)";
      btn.style.border = "1px solid var(--line-strong, #cbd5e1)";
      $("shapes-frame").src = src;
    } else {
      btn.style.background = "transparent";
      btn.style.boxShadow = "none";
      btn.style.border = "none";
    }
  });
}

if ($("tab-shapes-geo")) $("tab-shapes-geo").onclick = () => setShapesTab("tab-shapes-geo", "../shapes/index.html");
if ($("tab-shapes-venn")) $("tab-shapes-venn").onclick = () => setShapesTab("tab-shapes-venn", "../shapes/venn.html");
if ($("tab-shapes-optics")) $("tab-shapes-optics").onclick = () => setShapesTab("tab-shapes-optics", "../shapes/optics.html");

if ($("btn-insert-shapes")) {
  $("btn-insert-shapes").onclick = () => {
    const frame = $("shapes-frame");
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage({ action: "exportForMCQ" }, "*");
    }
  };
}

window.addEventListener("message", e => {
  if (e.data && e.data.type === "mcqDiagramData") {
    const { dataUrl, w, h } = e.data;
    const im = new Image();
    im.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = im.naturalWidth;
      cv.height = im.naturalHeight;
      const ctx = cv.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(im, 0, 0);

      qs[shapeQ].img = {
        src: cv.toDataURL("image/png"),
        wmm: Math.max(35, Math.min(85, Math.round(im.naturalWidth * 25.4 / 96 * 0.45))),
        nw: cv.width,
        nh: cv.height
      };
      const m = $("modal-shapes");
      if (m && m.open) m.close();
      renderList();
      debouncedPreview();
      showToast(`Diagram attached to Question ${shapeQ + 1}!`);
    };
    im.src = dataUrl;
  } else if (e.data && e.data.type === "mcqDiagramError") {
    alert(e.data.message || "Could not export diagram.");
  }
});


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

  // Automatically resolve absolute URLs for social sharing previews when served over HTTP/HTTPS
  try {
    if (window.location && window.location.protocol.startsWith('http')) {
      const loc = window.location;
      const fullUrl = loc.origin + loc.pathname;
      const dirPath = loc.pathname.substring(0, loc.pathname.lastIndexOf('/') + 1);
      const imgUrl = loc.origin + dirPath + 'og-preview.png';

      const setMeta = (sel, attr, val) => {
        const el = document.querySelector(sel);
        if (el) el.setAttribute(attr, val);
      };
      setMeta('meta[property="og:url"]', 'content', fullUrl);
      setMeta('meta[name="twitter:url"]', 'content', fullUrl);
      setMeta('meta[property="og:image"]', 'content', imgUrl);
      setMeta('meta[property="og:image:secure_url"]', 'content', imgUrl);
      setMeta('meta[name="twitter:image"]', 'content', imgUrl);
    }
  } catch (err) {}
})();

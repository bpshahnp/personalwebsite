/* ============================================
   admin.js — sign-in gate + add/update/delete
   for "questions" and "updates" Firestore collections.
   ============================================ */

/* Class levels used by the MCQ Hub. A question with no recognisable class
   is treated as Class 10 — the original question bank predates classes, so
   untagged questions are Class 10 by definition. This mirrors
   normalizeClass() in js/mcq.js; keep the two in step. */
const CLASS_LEVELS = ["8", "9", "10"];
const DEFAULT_CLASS = "10";


function normalizeSubject(q) {
  if (q && q.subject && String(q.subject).trim()) return String(q.subject).trim();
  const cat = String((q && q.category) || "").toLowerCase();
  if (cat.includes("science") && !cat.includes("computer")) return "Science";
  if (cat.includes("math") || cat.includes("algebra") || cat.includes("geometry") || cat.includes("arithmetic")) return "Mathematics";
  if (cat.includes("english") || cat.includes("grammar") || cat.includes("vocab")) return "English";
  if (cat.includes("gk") || cat.includes("general knowledge") || cat.includes("nepal") || cat.includes("history")) return "General Knowledge";
  return "Computer Science";
}

function normalizeClass(value) {
  const digits = String(value ?? "").match(/\d+/);
  const found = digits ? digits[0] : "";
  return CLASS_LEVELS.includes(found) ? found : DEFAULT_CLASS;
}

const signInGate = document.getElementById("signInGate");
const notAuthorized = document.getElementById("notAuthorized");
const dashboard = document.getElementById("dashboard");
const signOutBtns = document.querySelectorAll("#signOutBtn, #signOutBtnMobile");

/* ---------- Auth gate ---------- */
auth.onAuthStateChanged((user) => {
  if (!user) {
    show(signInGate);
    hide(notAuthorized, dashboard);
    signOutBtns.forEach((b) => (b.hidden = true));
    return;
  }
  signOutBtns.forEach((b) => (b.hidden = false));
  if (ADMIN_EMAILS.includes(user.email)) {
    show(dashboard);
    hide(signInGate, notAuthorized);
    initQuestionsAdmin();
    initPythonAdmin();
    initResourcesAdmin();
    initMessagesAdmin();
    initUpdatesAdmin();
    initLiveQuizAdmin();
    initPremiumQuizAdmin();
  } else {
    show(notAuthorized);
    hide(signInGate, dashboard);
  }
});

document.getElementById("adminLoginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("adminEmail").value;
  const password = document.getElementById("adminPassword").value;
  const status = document.getElementById("adminLoginStatus");
  auth
    .signInWithEmailAndPassword(email, password)
    .catch((err) => {
      status.textContent = err.message;
      status.style.color = "crimson";
    });
});

signOutBtns.forEach((b) => b.addEventListener("click", () => auth.signOut()));

function show(...els) { els.forEach((el) => (el.hidden = false)); }
function hide(...els) { els.forEach((el) => (el.hidden = true)); }

/* ---------- Tabs ---------- */
document.querySelectorAll(".admin-tab").forEach((tabBtn) => {
  tabBtn.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach((b) => b.classList.remove("active"));
    tabBtn.classList.add("active");
    document.getElementById("tab-questions").hidden = tabBtn.dataset.tab !== "questions";
    document.getElementById("tab-python").hidden = tabBtn.dataset.tab !== "python";
    document.getElementById("tab-resources").hidden = tabBtn.dataset.tab !== "resources";
    document.getElementById("tab-messages").hidden = tabBtn.dataset.tab !== "messages";
    document.getElementById("tab-updates").hidden = tabBtn.dataset.tab !== "updates";
    document.getElementById("tab-livequiz").hidden = tabBtn.dataset.tab !== "livequiz";
    document.getElementById("tab-premiumquiz").hidden = tabBtn.dataset.tab !== "premiumquiz";
  });
});

/* ============================================
   QUESTIONS — add / edit / delete
   ============================================ */
let questionsUnsub = null;

/* ============================================
   IMPORT UTILITIES — shared CSV/JSON parsing +
   file download helpers, used by both the Questions
   and Python Programs bulk-import sections.
   ============================================ */

// Minimal RFC4180-ish CSV parser (handles quoted fields with commas/newlines).
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

function downloadTextFile(filename, content, mimeType) {
  const dataUri = "data:" + (mimeType || "text/plain") + ";charset=utf-8," + encodeURIComponent(content);
  const a = document.createElement("a");
  a.href = dataUri;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Reads either the chosen file (if any) or the pasted textarea content.
function readImportInput(fileInput, textarea) {
  return new Promise((resolve, reject) => {
    if (fileInput.files && fileInput.files[0]) {
      const reader = new FileReader();
      reader.onload = () => resolve({ text: reader.result, name: fileInput.files[0].name });
      reader.onerror = () => reject(new Error("Could not read the selected file."));
      reader.readAsText(fileInput.files[0]);
    } else if (textarea.value.trim()) {
      resolve({ text: textarea.value, name: "" });
    } else {
      reject(new Error("Choose a file or paste content first."));
    }
  });
}

function looksLikeJson(text) {
  const t = text.trim();
  return t.startsWith("[") || t.startsWith("{");
}

// Parses question rows from either JSON or CSV text into the payload
// shape used by the "questions" collection.
function parseQuestionsInput(text) {
  if (looksLikeJson(text)) {
    const data = JSON.parse(text);
    const arr = Array.isArray(data) ? data : [data];
    return arr.map((q, i) => {
      if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) {
        throw new Error(`Row ${i + 1}: needs "question" and exactly 4 "options".`);
      }
      return {
        question: String(q.question).trim(),
        options: q.options.map((o) => String(o).trim()),
        correctIndex: Number(q.correctIndex) || 0,
        explanation: q.explanation ? String(q.explanation).trim() : "",
        subject: q.subject ? String(q.subject).trim() : normalizeSubject(q),
        category: q.category ? String(q.category).trim() : "General",
        classLevel: normalizeClass(q.classLevel ?? q.class),
      };
    });
  }

  // CSV path
  const rows = parseCSV(text);
  if (!rows.length) throw new Error("No rows found in CSV.");
  let startIdx = 0;
  if (/question/i.test(rows[0][0] || "")) startIdx = 1; // skip header row
  const results = [];
  for (let i = startIdx; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0] || !r[0].trim()) continue;
    // `class` is the last column and optional, so CSVs exported before
    // classes existed still import cleanly (they all become Class 10).
    let question, a, b, c, d, correct, explanation, subject, category, classLevel;
    if (r.length >= 10) {
      [question, a, b, c, d, correct, explanation, subject, category, classLevel] = r;
    } else {
      [question, a, b, c, d, correct, explanation, category, classLevel] = r;
      subject = "Computer Science";
    }
    if (!a || !b || !c || !d) {
      throw new Error(`Row ${i + 1}: needs question + 4 options (columns 2-5).`);
    }
    let correctIndex = 0;
    const cRaw = (correct || "").trim().toUpperCase();
    if (["A", "B", "C", "D"].includes(cRaw)) correctIndex = "ABCD".indexOf(cRaw);
    else if (["1", "2", "3", "4"].includes(cRaw)) correctIndex = Number(cRaw) - 1;
    else if (["0", "1", "2", "3"].includes(cRaw)) correctIndex = Number(cRaw);

    results.push({
      question: question.trim(),
      options: [a.trim(), b.trim(), c.trim(), d.trim()],
      correctIndex,
      explanation: (explanation || "").trim(),
      subject: (subject || "Computer Science").trim(),
      category: (category || "General").trim(),
      classLevel: normalizeClass(classLevel),
    });
  }
  if (!results.length) throw new Error("No valid question rows found.");
  return results;
}

// Parses program entries from JSON text into the "pythonPrograms" shape.
function parseProgramsInput(text) {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : [data];
  return arr.map((p, i) => {
    if (!p.title || !p.code) {
      throw new Error(`Entry ${i + 1}: needs at least "title" and "code".`);
    }
    return {
      title: String(p.title).trim(),
      category: p.category ? String(p.category).trim() : "",
      description: p.description ? String(p.description).trim() : "",
      code: String(p.code),
    };
  });
}

function initQuestionsAdmin() {
  if (questionsUnsub) return; // already listening
  const form = document.getElementById("questionForm");
  const listEl = document.getElementById("questionsAdminList");
  const submitBtn = document.getElementById("questionSubmitBtn");
  const cancelBtn = document.getElementById("cancelQuestionEdit");
  const idField = document.getElementById("questionId");
  const classFilter = document.getElementById("questionClassFilter");
  const subjectFilter = document.getElementById("questionSubjectFilter");
  const countLabel = document.getElementById("questionCountLabel");
  const qSubjectSelect = document.getElementById("qSubject");
  const qCustomSubjectWrap = document.getElementById("qCustomSubjectWrap");
  const qCustomSubjectInput = document.getElementById("qCustomSubject");

  let allQuestions = []; // latest snapshot, newest first, class already normalised

  classFilter.addEventListener("change", renderQuestionList);
  if (subjectFilter) subjectFilter.addEventListener("change", renderQuestionList);
  if (qSubjectSelect) {
    qSubjectSelect.addEventListener("change", () => {
      if (qCustomSubjectWrap) {
        qCustomSubjectWrap.style.display = qSubjectSelect.value === "Other" ? "block" : "none";
      }
    });
  }

  questionsUnsub = db.collection("questions").orderBy("order", "desc").onSnapshot(
    (snapshot) => {
      allQuestions = snapshot.docs.map((doc) => {
        const data = doc.data();
        return { id: doc.id, ...data, subject: normalizeSubject(data), classLevel: normalizeClass(data.classLevel ?? data.class) };
      });
      renderQuestionList();
    },
    (err) => {
      listEl.innerHTML = `<p class="updates-loading">Could not load questions (${err.message}).</p>`;
    }
  );

  function renderQuestionList() {
    const filterClass = classFilter.value;
    const filterSubject = subjectFilter ? subjectFilter.value : "All";
    const visible = allQuestions.filter((q) => {
      const matchClass = filterClass === "All" || q.classLevel === filterClass;
      const matchSubject = filterSubject === "All" || (q.subject || normalizeSubject(q)) === filterSubject;
      return matchClass && matchSubject;
    });

    const perClass = CLASS_LEVELS.map(
      (lvl) => `Class ${lvl}: ${allQuestions.filter((q) => q.classLevel === lvl).length}`
    ).join(" · ");
    countLabel.textContent = allQuestions.length
      ? `${allQuestions.length} total — ${perClass}`
      : "";

    if (!visible.length) {
      listEl.innerHTML = `<p class="updates-loading">${
        allQuestions.length
          ? "No questions match the selected filters — add one above."
          : "No questions yet — add one above."
      }</p>`;
      return;
    }

    listEl.innerHTML = "";
    visible.forEach((q) => {
      const subj = q.subject || normalizeSubject(q);
      const row = document.createElement("div");
      row.className = "admin-row";
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(q.question || "")}</strong>
          <span class="admin-tag">Class ${escapeHtml(q.classLevel)}</span>
          <span class="admin-tag" style="background:#e0f2fe; color:#0369a1; font-weight:600;">${escapeHtml(subj)}</span>
          ${q.category ? `<span class="admin-tag">${escapeHtml(q.category)}</span>` : ""}
        </div>
        <div class="admin-row-actions">
          <button class="btn btn-outline btn-sm" data-action="edit">Edit</button>
          <button class="btn btn-outline btn-sm btn-danger" data-action="delete">Delete</button>
        </div>
      `;
      row.querySelector('[data-action="edit"]').addEventListener("click", () => startEdit(q));
      row.querySelector('[data-action="delete"]').addEventListener("click", () => {
        if (confirm("Delete this question?")) db.collection("questions").doc(q.id).delete();
      });
      listEl.appendChild(row);
    });
  }

  function startEdit(q) {
    idField.value = q.id;
    document.getElementById("qText").value = q.question || "";
    document.getElementById("opt0").value = (q.options || [])[0] || "";
    document.getElementById("opt1").value = (q.options || [])[1] || "";
    document.getElementById("opt2").value = (q.options || [])[2] || "";
    document.getElementById("opt3").value = (q.options || [])[3] || "";
    document.getElementById("correctIndex").value = q.correctIndex ?? 0;
    document.getElementById("qExplanation").value = q.explanation || "";
    document.getElementById("qCategory").value = q.category || "";
    document.getElementById("qClass").value = q.classLevel;
    const subj = q.subject || normalizeSubject(q);
    if (qSubjectSelect) {
      const std = ["Computer Science", "Science", "Mathematics", "English", "General Knowledge"];
      if (std.includes(subj)) {
        qSubjectSelect.value = subj;
        if (qCustomSubjectWrap) qCustomSubjectWrap.style.display = "none";
      } else {
        qSubjectSelect.value = "Other";
        if (qCustomSubjectWrap) qCustomSubjectWrap.style.display = "block";
        if (qCustomSubjectInput) qCustomSubjectInput.value = subj;
      }
    }
    submitBtn.textContent = "Save changes";
    cancelBtn.hidden = false;
    form.scrollIntoView({ behavior: "smooth" });
  }

  cancelBtn.addEventListener("click", () => resetQuestionForm());

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let chosenSubject = "Computer Science";
    if (qSubjectSelect) {
      if (qSubjectSelect.value === "Other" && qCustomSubjectInput && qCustomSubjectInput.value.trim()) {
        chosenSubject = qCustomSubjectInput.value.trim();
      } else {
        chosenSubject = qSubjectSelect.value;
      }
    }

    const payload = {
      question: document.getElementById("qText").value.trim(),
      options: [
        document.getElementById("opt0").value.trim(),
        document.getElementById("opt1").value.trim(),
        document.getElementById("opt2").value.trim(),
        document.getElementById("opt3").value.trim(),
      ],
      correctIndex: Number(document.getElementById("correctIndex").value),
      explanation: document.getElementById("qExplanation").value.trim(),
      subject: chosenSubject,
      category: document.getElementById("qCategory").value.trim() || "General",
      classLevel: normalizeClass(document.getElementById("qClass").value),
    };

    const editingId = idField.value;
    const savePromise = editingId
      ? db.collection("questions").doc(editingId).update(payload)
      : db.collection("questions").add({ ...payload, order: Date.now() });

    savePromise.then(() => resetQuestionForm()).catch((err) => alert(err.message));
  });

  function resetQuestionForm() {
    form.reset();
    idField.value = "";
    document.getElementById("qClass").value = DEFAULT_CLASS;
    if (qSubjectSelect) qSubjectSelect.value = "Computer Science";
    if (qCustomSubjectWrap) qCustomSubjectWrap.style.display = "none";
    if (qCustomSubjectInput) qCustomSubjectInput.value = "";
    submitBtn.textContent = "Add question";
    cancelBtn.hidden = true;
  }

  /* ---- Bulk import ---- */
  const importFile = document.getElementById("questionImportFile");
  const importText = document.getElementById("questionImportText");
  const importBtn = document.getElementById("questionImportBtn");
  const importStatus = document.getElementById("questionImportStatus");

  importBtn.addEventListener("click", () => {
    importStatus.style.color = "";
    importStatus.textContent = "Reading…";
    readImportInput(importFile, importText)
      .then(({ text }) => {
        const parsed = parseQuestionsInput(text);
        importStatus.textContent = `Importing ${parsed.length} question(s)…`;
        const baseOrder = Date.now();
        const batch = db.batch();
        parsed.forEach((q, i) => {
          const ref = db.collection("questions").doc();
          batch.set(ref, { ...q, order: baseOrder + i });
        });
        return batch.commit().then(() => parsed.length);
      })
      .then((count) => {
        importStatus.style.color = "green";
        importStatus.textContent = `Imported ${count} question(s) successfully.`;
        importFile.value = "";
        importText.value = "";
      })
      .catch((err) => {
        importStatus.style.color = "crimson";
        importStatus.textContent = err.message;
      });
  });

  document.getElementById("downloadQuestionCsvTemplate").addEventListener("click", (e) => {
    e.preventDefault();
    const csv =
      "question,option_a,option_b,option_c,option_d,correct,explanation,subject,category,class\n" +
      '"What does len() return for a list?","Its length","Its type","Its memory address","Nothing",A,"len() returns the number of items in a list.","Computer Science","Python Basics",10\n' +
      '"What is the chemical formula of water?","CO2","H2O","NaCl","O2",B,"Water is composed of two hydrogen atoms and one oxygen atom.","Science","Chemistry",9\n' +
      '"What is the sum of angles in a triangle?","90°","180°","270°","360°",B,"The interior angles of a triangle always add up to 180°.","Mathematics","Geometry",8\n';
    downloadTextFile("questions-template.csv", csv, "text/csv");
  });

  document.getElementById("downloadQuestionJsonTemplate").addEventListener("click", (e) => {
    e.preventDefault();
    const json = JSON.stringify(
      [
        {
          question: "What does len() return for a list?",
          options: ["Its length", "Its type", "Its memory address", "Nothing"],
          correctIndex: 0,
          explanation: "len() returns the number of items in a list.",
          category: "Python Basics",
          classLevel: "10",
        },
        {
          question: "Which symbol starts a comment in Python?",
          options: ["//", "#", "/*", "--"],
          correctIndex: 1,
          explanation: "Python comments begin with #.",
          category: "Python Basics",
          classLevel: "8",
        },
      ],
      null,
      2
    );
    downloadTextFile("questions-template.json", json, "application/json");
  });
}

/* ============================================
   PYTHON PROGRAMS — add / edit / delete
   ============================================ */
let pythonUnsub = null;

function initPythonAdmin() {
  if (pythonUnsub) return;
  const form = document.getElementById("pythonForm");
  const listEl = document.getElementById("pythonAdminList");
  const submitBtn = document.getElementById("pythonSubmitBtn");
  const cancelBtn = document.getElementById("cancelPythonEdit");
  const idField = document.getElementById("pyId");

  pythonUnsub = db.collection("pythonPrograms").orderBy("order", "desc").onSnapshot(
    (snapshot) => {
      if (snapshot.empty) {
        listEl.innerHTML = `<p class="updates-loading">No programs yet — add one above.</p>`;
        return;
      }
      listEl.innerHTML = "";
      snapshot.forEach((doc) => {
        const p = doc.data();
        const row = document.createElement("div");
        row.className = "admin-row";
        row.innerHTML = `
          <div>
            <strong>${escapeHtml(p.title || "")}</strong>
            ${p.category ? `<span class="admin-tag">${escapeHtml(p.category)}</span>` : ""}
          </div>
          <div class="admin-row-actions">
            <button class="btn btn-outline btn-sm" data-action="edit">Edit</button>
            <button class="btn btn-outline btn-sm btn-danger" data-action="delete">Delete</button>
          </div>
        `;
        row.querySelector('[data-action="edit"]').addEventListener("click", () => {
          idField.value = doc.id;
          document.getElementById("pyTitle").value = p.title || "";
          document.getElementById("pyCategory").value = p.category || "";
          document.getElementById("pyOrder").value = p.order ?? 1;
          document.getElementById("pyDescription").value = p.description || "";
          document.getElementById("pyCode").value = p.code || "";
          submitBtn.textContent = "Save changes";
          cancelBtn.hidden = false;
          form.scrollIntoView({ behavior: "smooth" });
        });
        row.querySelector('[data-action="delete"]').addEventListener("click", () => {
          if (confirm("Delete this program?")) db.collection("pythonPrograms").doc(doc.id).delete();
        });
        listEl.appendChild(row);
      });
    },
    (err) => {
      listEl.innerHTML = `<p class="updates-loading">Could not load programs (${err.message}).</p>`;
    }
  );

  cancelBtn.addEventListener("click", () => resetPythonForm());

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById("pyTitle").value.trim(),
      category: document.getElementById("pyCategory").value.trim(),
      description: document.getElementById("pyDescription").value.trim(),
      code: document.getElementById("pyCode").value,
      order: Number(document.getElementById("pyOrder").value),
    };
    const editingId = idField.value;
    const savePromise = editingId
      ? db.collection("pythonPrograms").doc(editingId).update(payload)
      : db.collection("pythonPrograms").add(payload);

    savePromise.then(() => resetPythonForm()).catch((err) => alert(err.message));
  });

  function resetPythonForm() {
    form.reset();
    idField.value = "";
    document.getElementById("pyOrder").value = 1;
    submitBtn.textContent = "Add program";
    cancelBtn.hidden = true;
  }

  /* ---- Bulk import ---- */
  const importFile = document.getElementById("pythonImportFile");
  const importText = document.getElementById("pythonImportText");
  const importBtn = document.getElementById("pythonImportBtn");
  const importStatus = document.getElementById("pythonImportStatus");

  importBtn.addEventListener("click", () => {
    importStatus.style.color = "";
    importStatus.textContent = "Reading…";
    readImportInput(importFile, importText)
      .then(({ text }) => {
        const parsed = parseProgramsInput(text);
        importStatus.textContent = `Importing ${parsed.length} program(s)…`;
        const baseOrder = Date.now();
        const batch = db.batch();
        parsed.forEach((p, i) => {
          const ref = db.collection("pythonPrograms").doc();
          batch.set(ref, { ...p, order: baseOrder + i });
        });
        return batch.commit().then(() => parsed.length);
      })
      .then((count) => {
        importStatus.style.color = "green";
        importStatus.textContent = `Imported ${count} program(s) successfully.`;
        importFile.value = "";
        importText.value = "";
      })
      .catch((err) => {
        importStatus.style.color = "crimson";
        importStatus.textContent = err.message;
      });
  });

  document.getElementById("downloadPythonJsonTemplate").addEventListener("click", (e) => {
    e.preventDefault();
    const json = JSON.stringify(
      [
        {
          title: "Sum of a list",
          category: "Loops",
          description: "Adds up all numbers in a list using a for loop.",
          code: "numbers = [1, 2, 3, 4, 5]\ntotal = 0\nfor n in numbers:\n    total += n\nprint(total)",
        },
      ],
      null,
      2
    );
    downloadTextFile("python-programs-template.json", json, "application/json");
  });
}

/* ============================================
   UPDATES — add / edit / delete
   ============================================ */
let updatesUnsub = null;

/* ============================================
   RESOURCES — add / edit / delete
   (title, file type, description, Google Drive link)
   ============================================ */
let resourcesUnsub = null;

function initResourcesAdmin() {
  if (resourcesUnsub) return;
  const form = document.getElementById("resourceForm");
  const listEl = document.getElementById("resourcesAdminList");
  const submitBtn = document.getElementById("resourceSubmitBtn");
  const cancelBtn = document.getElementById("cancelResourceEdit");
  const idField = document.getElementById("resId");

  resourcesUnsub = db.collection("resources").orderBy("order", "desc").onSnapshot(
    (snapshot) => {
      if (snapshot.empty) {
        listEl.innerHTML = `<p class="updates-loading">No resources yet — add one above.</p>`;
        return;
      }
      listEl.innerHTML = "";
      snapshot.forEach((doc) => {
        const r = doc.data();
        const row = document.createElement("div");
        row.className = "admin-row";
        row.innerHTML = `
          <div>
            <strong>${escapeHtml(r.title || "")}</strong>
            <span class="admin-tag">${escapeHtml(r.fileType || "")}${r.category ? " · " + escapeHtml(r.category) : ""}</span>
          </div>
          <div class="admin-row-actions">
            <button class="btn btn-outline btn-sm" data-action="edit">Edit</button>
            <button class="btn btn-outline btn-sm btn-danger" data-action="delete">Delete</button>
          </div>
        `;
        row.querySelector('[data-action="edit"]').addEventListener("click", () => {
          idField.value = doc.id;
          document.getElementById("resTitle").value = r.title || "";
          document.getElementById("resFileType").value = r.fileType || "PPT";
          document.getElementById("resCategory").value = r.category || "";
          document.getElementById("resDescription").value = r.description || "";
          document.getElementById("resDriveUrl").value = r.driveUrl || "";
          document.getElementById("resOrder").value = r.order ?? 1;
          submitBtn.textContent = "Save changes";
          cancelBtn.hidden = false;
          form.scrollIntoView({ behavior: "smooth" });
        });
        row.querySelector('[data-action="delete"]').addEventListener("click", () => {
          if (confirm("Delete this resource?")) db.collection("resources").doc(doc.id).delete();
        });
        listEl.appendChild(row);
      });
    },
    (err) => {
      listEl.innerHTML = `<p class="updates-loading">Could not load resources (${err.message}).</p>`;
    }
  );

  cancelBtn.addEventListener("click", () => resetResourceForm());

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById("resTitle").value.trim(),
      fileType: document.getElementById("resFileType").value,
      category: document.getElementById("resCategory").value.trim(),
      description: document.getElementById("resDescription").value.trim(),
      driveUrl: document.getElementById("resDriveUrl").value.trim(),
      order: Number(document.getElementById("resOrder").value),
    };
    const editingId = idField.value;
    const savePromise = editingId
      ? db.collection("resources").doc(editingId).update(payload)
      : db.collection("resources").add(payload);

    savePromise.then(() => resetResourceForm()).catch((err) => alert(err.message));
  });

  function resetResourceForm() {
    form.reset();
    idField.value = "";
    document.getElementById("resOrder").value = 1;
    submitBtn.textContent = "Add resource";
    cancelBtn.hidden = true;
  }
}

/* ============================================
   MESSAGES — read-only inbox + delete
   (contact form submissions; no admin write/edit,
   visitors create these, admin can only view/delete)
   ============================================ */
let messagesUnsub = null;

function initMessagesAdmin() {
  if (messagesUnsub) return;
  const listEl = document.getElementById("messagesAdminList");

  messagesUnsub = db.collection("messages").orderBy("createdAt", "desc").onSnapshot(
    (snapshot) => {
      if (snapshot.empty) {
        listEl.innerHTML = `<p class="updates-loading">No messages yet.</p>`;
        return;
      }
      listEl.innerHTML = "";
      snapshot.forEach((doc) => {
        const m = doc.data();
        const when = m.createdAt && m.createdAt.toDate ? m.createdAt.toDate().toLocaleString() : "";
        const row = document.createElement("div");
        row.className = "admin-row";
        row.style.alignItems = "flex-start";
        row.innerHTML = `
          <div>
            <strong>${escapeHtml(m.subject || "(no subject)")}</strong>
            <span class="admin-tag">${escapeHtml(when)}</span>
            <p style="margin:6px 0 4px;font-size:0.9rem;color:var(--ink)">${escapeHtml(m.message || "")}</p>
            <p style="margin:0;font-size:0.82rem;color:var(--mist)">
              From: ${escapeHtml(m.name || "")} — <a href="mailto:${escapeHtml(m.email || "")}">${escapeHtml(m.email || "")}</a>
            </p>
          </div>
          <div class="admin-row-actions">
            <button class="btn btn-outline btn-sm btn-danger" data-action="delete">Delete</button>
          </div>
        `;
        row.querySelector('[data-action="delete"]').addEventListener("click", () => {
          if (confirm("Delete this message?")) db.collection("messages").doc(doc.id).delete();
        });
        listEl.appendChild(row);
      });
    },
    (err) => {
      listEl.innerHTML = `<p class="updates-loading">Could not load messages (${err.message}).</p>`;
    }
  );
}

function initUpdatesAdmin() {
  if (updatesUnsub) return;
  const form = document.getElementById("updateForm");
  const listEl = document.getElementById("updatesAdminList");
  const submitBtn = document.getElementById("updateSubmitBtn");
  const cancelBtn = document.getElementById("cancelUpdateEdit");
  const idField = document.getElementById("updateId");

  updatesUnsub = db.collection("updates").orderBy("order", "desc").onSnapshot(
    (snapshot) => {
      if (snapshot.empty) {
        listEl.innerHTML = `<p class="updates-loading">No updates yet — add one above.</p>`;
        return;
      }
      listEl.innerHTML = "";
      snapshot.forEach((doc) => {
        const u = doc.data();
        const row = document.createElement("div");
        row.className = "admin-row";
        row.innerHTML = `
          <div><strong>${escapeHtml(u.title || "")}</strong> <span class="admin-tag">${escapeHtml(u.date || "")}</span></div>
          <div class="admin-row-actions">
            <button class="btn btn-outline btn-sm" data-action="edit">Edit</button>
            <button class="btn btn-outline btn-sm btn-danger" data-action="delete">Delete</button>
          </div>
        `;
        row.querySelector('[data-action="edit"]').addEventListener("click", () => {
          idField.value = doc.id;
          document.getElementById("uTitle").value = u.title || "";
          document.getElementById("uDate").value = u.date || "";
          document.getElementById("uOrder").value = u.order ?? 1;
          submitBtn.textContent = "Save changes";
          cancelBtn.hidden = false;
          form.scrollIntoView({ behavior: "smooth" });
        });
        row.querySelector('[data-action="delete"]').addEventListener("click", () => {
          if (confirm("Delete this update?")) db.collection("updates").doc(doc.id).delete();
        });
        listEl.appendChild(row);
      });
    },
    (err) => {
      listEl.innerHTML = `<p class="updates-loading">Could not load updates (${err.message}).</p>`;
    }
  );

  cancelBtn.addEventListener("click", () => resetUpdateForm());

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById("uTitle").value.trim(),
      date: document.getElementById("uDate").value.trim(),
      order: Number(document.getElementById("uOrder").value),
    };
    const editingId = idField.value;
    const savePromise = editingId
      ? db.collection("updates").doc(editingId).update(payload)
      : db.collection("updates").add(payload);

    savePromise.then(() => resetUpdateForm()).catch((err) => alert(err.message));
  });

  function resetUpdateForm() {
    form.reset();
    idField.value = "";
    document.getElementById("uOrder").value = 1;
    submitBtn.textContent = "Add update";
    cancelBtn.hidden = true;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ============================================
   LIVE QUIZ SCHEDULE ADMIN
   ============================================ */
function initLiveQuizAdmin() {
  const daySelect = document.getElementById("adminLiveDaySelect");
  const weekInput = document.getElementById("adminLiveWeekInput");
  const customJson = document.getElementById("adminLiveCustomJson");
  const saveBtn = document.getElementById("saveLiveDayQuestionsBtn");
  const clearBtn = document.getElementById("clearLiveDayQuestionsBtn");
  const statusEl = document.getElementById("adminLiveStatus");

  if (!daySelect || !weekInput || !saveBtn) return;

  function getISOWeekKey() {
    const d = new Date();
    const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNr = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - dayNr);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
    const pad = (n) => String(n).padStart(2, "0");
    return `${target.getUTCFullYear()}-W${pad(weekNo)}`;
  }

  const d = new Date();
  const currentDayNr = d.getUTCDay() || 7;
  daySelect.value = String(currentDayNr);
  weekInput.value = getISOWeekKey();

  async function loadSelectedDayQuestions() {
    statusEl.textContent = "Checking schedule…";
    statusEl.style.color = "var(--mist)";
    const week = weekInput.value.trim();
    const day = daySelect.value;
    const docId = `${week}_day_${day}`;

    try {
      const snap = await db.collection("liveQuizQuestions").doc(docId).get();
      if (snap.exists && Array.isArray(snap.data().questions) && snap.data().questions.length > 0) {
        customJson.value = JSON.stringify(snap.data().questions, null, 2);
        statusEl.textContent = `Custom questions active for ${week} Day ${day} (${snap.data().questions.length} questions).`;
        statusEl.style.color = "var(--orange)";
      } else {
        customJson.value = "";
        statusEl.textContent = `Automated smart selection is active for ${week} Day ${day}.`;
        statusEl.style.color = "var(--mist)";
      }
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.style.color = "crimson";
    }
  }

  daySelect.addEventListener("change", loadSelectedDayQuestions);
  weekInput.addEventListener("change", loadSelectedDayQuestions);
  loadSelectedDayQuestions();

  saveBtn.addEventListener("click", async () => {
    const week = weekInput.value.trim();
    const day = daySelect.value;
    const docId = `${week}_day_${day}`;
    const raw = customJson.value.trim();

    if (!raw) {
      statusEl.textContent = "Please enter JSON array of questions, or click Reset.";
      statusEl.style.color = "crimson";
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("Questions must be a non-empty JSON array.");
      }

      statusEl.textContent = "Saving questions…";
      await db.collection("liveQuizQuestions").doc(docId).set({
        weekKey: week,
        dayIndex: Number(day),
        questions: parsed,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      statusEl.textContent = `Saved ${parsed.length} custom questions for ${week} Day ${day}!`;
      statusEl.style.color = "#10b981";
    } catch (err) {
      statusEl.textContent = `JSON Error: ${err.message}`;
      statusEl.style.color = "crimson";
    }
  });

  clearBtn.addEventListener("click", async () => {
    const week = weekInput.value.trim();
    const day = daySelect.value;
    const docId = `${week}_day_${day}`;

    if (!confirm(`Reset ${week} Day ${day} back to automated daily question selection?`)) return;

    try {
      statusEl.textContent = "Resetting…";
      await db.collection("liveQuizQuestions").doc(docId).delete();
      customJson.value = "";
      statusEl.textContent = `Reset successful! ${week} Day ${day} will now use automated smart question selection.`;
      statusEl.style.color = "#10b981";
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.style.color = "crimson";
    }
  });
}

/* ============================================
   PREMIUM QUIZ ADMIN
   Manages: siteSettings/config (minScore),
            premiumQuizContent/{slug} (category meta + questions array)
   ============================================ */
function initPremiumQuizAdmin() {
  const minScoreInput   = document.getElementById("premiumMinScore");
  const saveMinScoreBtn = document.getElementById("savePremiumMinScoreBtn");
  const settingsStatus  = document.getElementById("premiumSettingsStatus");

  // Payment Verification Requests DOM
  const reqListEl         = document.getElementById("premiumRequestsList");
  const reqFilterBtns     = document.querySelectorAll(".req-filter-btn");
  const manualGrantEmail  = document.getElementById("manualGrantEmail");
  const manualGrantBtn    = document.getElementById("manualGrantBtn");
  const manualRevokeBtn   = document.getElementById("manualRevokeBtn");
  const manualGrantStatus = document.getElementById("manualGrantStatus");

  // Receipt Modal DOM
  const receiptModal      = document.getElementById("receiptPreviewModal");
  const modalReceiptImg   = document.getElementById("modalReceiptImg");
  const closeReceiptBtn   = document.getElementById("closeReceiptModalBtn");

  if (closeReceiptBtn && receiptModal) {
    closeReceiptBtn.addEventListener("click", () => {
      receiptModal.style.display = "none";
      receiptModal.hidden = true;
    });
    receiptModal.addEventListener("click", e => {
      if (e.target === receiptModal) {
        receiptModal.style.display = "none";
        receiptModal.hidden = true;
      }
    });
  }

  function openReceiptModal(imgSrc) {
    if (!receiptModal || !modalReceiptImg) return;
    modalReceiptImg.src = imgSrc;
    receiptModal.hidden = false;
    receiptModal.style.display = "flex";
  }

  // ---- Payment Verification Requests Live Subscription ----
  let allRequests = [];
  let currentRequestFilter = "all";

  if (reqFilterBtns.length > 0) {
    reqFilterBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        reqFilterBtns.forEach(b => {
          b.classList.remove("btn-primary");
          b.classList.add("btn-outline");
        });
        btn.classList.remove("btn-outline");
        btn.classList.add("btn-primary");
        currentRequestFilter = btn.dataset.status || "all";
        renderPaymentRequests();
      });
    });
  }

  function subscribePaymentRequests() {
    if (!reqListEl) return;
    db.collection("premiumRequests")
      .orderBy("createdAt", "desc")
      .onSnapshot(snap => {
        allRequests = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
        renderPaymentRequests();
      }, err => {
        console.error("Error loading payment requests:", err);
        reqListEl.innerHTML = `<p class="updates-loading">Error loading requests: ${err.message}</p>`;
      });
  }

  function renderPaymentRequests() {
    if (!reqListEl) return;
    const filtered = allRequests.filter(r => {
      if (currentRequestFilter === "all") return true;
      return r.status === currentRequestFilter;
    });

    if (filtered.length === 0) {
      reqListEl.innerHTML = `<p class="updates-loading">No ${currentRequestFilter === "all" ? "" : currentRequestFilter} requests found.</p>`;
      return;
    }

    reqListEl.innerHTML = "";
    filtered.forEach(req => {
      const card = document.createElement("div");
      card.className = "admin-row";
      card.style.cssText = "display:flex; justify-content:space-between; align-items:flex-start; gap:14px; padding:14px; border:1px solid var(--border); border-radius:10px; margin-bottom:10px; background:var(--bg, #fff);";

      const statusColor = req.status === "approved" ? "#10b981" : (req.status === "rejected" ? "#ef4444" : "#f59e0b");
      const statusBg = req.status === "approved" ? "#ecfdf5" : (req.status === "rejected" ? "#fef2f2" : "#fffbeb");
      const formattedDate = req.createdAt && req.createdAt.toDate ? req.createdAt.toDate().toLocaleString() : "Recently";

      card.innerHTML = `
        <div style="flex:1;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap;">
            <strong>${escapeHtml(req.userName || "User")}</strong>
            <span class="admin-tag">${escapeHtml(req.userEmail || "")}</span>
            <span class="admin-tag" style="background:${statusBg}; color:${statusColor}; font-weight:700; text-transform:uppercase;">${escapeHtml(req.status || "pending")}</span>
          </div>

          <div style="font-size:0.86rem; color:var(--text); line-height:1.6;">
            <div><strong>Method:</strong> ${escapeHtml(req.paymentMethod || "eSewa")} · <strong>Amount:</strong> NPR ${escapeHtml(String(req.amountNpr || 200))} · <strong>Ref Code:</strong> <code style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-weight:700;">${escapeHtml(req.referenceCode || "-")}</code></div>
            <div><strong>Phone:</strong> ${escapeHtml(req.userPhone || "Not provided")} · <strong>Submitted:</strong> ${formattedDate}</div>
            ${req.remarks ? `<div><strong>Remarks:</strong> <em>${escapeHtml(req.remarks)}</em></div>` : ""}
          </div>
        </div>

        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px; flex-shrink:0;">
          ${req.screenshotUrl ? `
            <button type="button" class="btn btn-outline btn-sm view-receipt-btn" style="font-size:0.78rem; padding:4px 8px;">
              View Screenshot
            </button>
          ` : `<span style="font-size:0.75rem; color:#94a3b8;">No Image</span>`}

          <div style="display:flex; gap:6px;">
            ${req.status !== "approved" ? `
              <button type="button" class="btn btn-primary btn-sm approve-req-btn" style="padding:4px 10px; font-size:0.8rem; background:#10b981; border-color:#10b981;">
                Approve
              </button>
            ` : ""}
            ${req.status !== "rejected" ? `
              <button type="button" class="btn btn-outline btn-sm btn-danger reject-req-btn" style="padding:4px 10px; font-size:0.8rem;">
                Reject
              </button>
            ` : ""}
          </div>
        </div>
      `;

      if (req.screenshotUrl) {
        card.querySelector(".view-receipt-btn").addEventListener("click", () => {
          openReceiptModal(req.screenshotUrl);
        });
      }

      const approveBtn = card.querySelector(".approve-req-btn");
      if (approveBtn) {
        approveBtn.addEventListener("click", async () => {
          if (!confirm(`Approve payment for ${req.userEmail}? This will grant them instant premium access.`)) return;
          approveBtn.disabled = true;
          approveBtn.textContent = "Approving…";
          try {
            // 1. Update request status
            await db.collection("premiumRequests").doc(req.id).update({
              status: "approved",
              approvedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 2. Grant premium access in users collection
            if (req.userId) {
              await db.collection("users").doc(req.userId).set({
                hasPremiumAccess: true,
                premiumApprovedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
              }, { merge: true });
            }
            alert(`Payment approved! Full premium access granted to ${req.userEmail}.`);
          } catch (err) {
            alert("Error approving request: " + err.message);
          }
        });
      }

      const rejectBtn = card.querySelector(".reject-req-btn");
      if (rejectBtn) {
        rejectBtn.addEventListener("click", async () => {
          if (!confirm(`Reject payment request for ${req.userEmail}?`)) return;
          rejectBtn.disabled = true;
          rejectBtn.textContent = "Rejecting…";
          try {
            await db.collection("premiumRequests").doc(req.id).update({
              status: "rejected",
              rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (req.userId) {
              await db.collection("users").doc(req.userId).set({
                hasPremiumAccess: false,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
              }, { merge: true });
            }
          } catch (err) {
            alert("Error rejecting request: " + err.message);
          }
        });
      }

      reqListEl.appendChild(card);
    });
  }

  // ---- Manual Access Override by Email ----
  if (manualGrantBtn && manualGrantEmail) {
    manualGrantBtn.addEventListener("click", async () => {
      const email = manualGrantEmail.value.trim().toLowerCase();
      if (!email || !email.includes("@")) {
        manualGrantStatus.textContent = "Please enter a valid email address.";
        manualGrantStatus.style.color = "crimson";
        return;
      }
      manualGrantBtn.disabled = true;
      manualGrantStatus.textContent = "Searching user and granting access…";
      manualGrantStatus.style.color = "#475569";

      try {
        const snap = await db.collection("users").where("email", "==", email).limit(1).get();
        if (snap.empty) {
          manualGrantStatus.textContent = `No account found registered with email "${email}". The user must register first.`;
          manualGrantStatus.style.color = "crimson";
        } else {
          const userDoc = snap.docs[0];
          await userDoc.ref.set({
            hasPremiumAccess: true,
            premiumApprovedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          manualGrantStatus.textContent = `Success! Premium access granted to ${email}.`;
          manualGrantStatus.style.color = "#10b981";
          manualGrantEmail.value = "";
        }
      } catch (err) {
        manualGrantStatus.textContent = "Error: " + err.message;
        manualGrantStatus.style.color = "crimson";
      } finally {
        manualGrantBtn.disabled = false;
      }
    });
  }

  if (manualRevokeBtn && manualGrantEmail) {
    manualRevokeBtn.addEventListener("click", async () => {
      const email = manualGrantEmail.value.trim().toLowerCase();
      if (!email || !email.includes("@")) {
        manualGrantStatus.textContent = "Please enter a valid email address.";
        manualGrantStatus.style.color = "crimson";
        return;
      }
      manualRevokeBtn.disabled = true;
      manualGrantStatus.textContent = "Revoking access…";
      manualGrantStatus.style.color = "#475569";

      try {
        const snap = await db.collection("users").where("email", "==", email).limit(1).get();
        if (snap.empty) {
          manualGrantStatus.textContent = `No account found with email "${email}".`;
          manualGrantStatus.style.color = "crimson";
        } else {
          const userDoc = snap.docs[0];
          await userDoc.ref.set({
            hasPremiumAccess: false,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          manualGrantStatus.textContent = `Premium access revoked for ${email}.`;
          manualGrantStatus.style.color = "#10b981";
          manualGrantEmail.value = "";
        }
      } catch (err) {
        manualGrantStatus.textContent = "Error: " + err.message;
        manualGrantStatus.style.color = "crimson";
      } finally {
        manualRevokeBtn.disabled = false;
      }
    });
  }

  subscribePaymentRequests();

  // ---- Category Manager DOM refs ----
  const catNameInput    = document.getElementById("premiumCatName");
  const catSlugInput    = document.getElementById("premiumCatSlug");
  const catImageInput   = document.getElementById("premiumCatImage");
  const catCreditsInput = document.getElementById("premiumCatCredits");
  const catDescInput    = document.getElementById("premiumCatDesc");
  const addCatBtn       = document.getElementById("addPremiumCategoryBtn");
  const catStatus       = document.getElementById("premiumCatStatus");
  const catListEl       = document.getElementById("premiumCatList");
  const qCatSelect      = document.getElementById("premiumQCategorySelect");
  const qListEl         = document.getElementById("premiumQList");

  // ---- Auto-generate slug from name ----
  catNameInput.addEventListener("input", () => {
    catSlugInput.value = catNameInput.value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  });

  // ---- Category CRUD ----
  let categoryDocs = []; // [{id, name, imageUrl, description, credits}] live list

  function subscribeCategories() {
    db.collection("premiumQuizContent")
      .orderBy("name")
      .onSnapshot(snap => {
        categoryDocs = snap.docs.map(d => ({
          id: d.id,
          name: d.data().name || d.id,
          imageUrl: d.data().imageUrl || "",
          description: d.data().description || "",
          credits: d.data().credits ?? 3,
          questions: d.data().questions || []
        }));
        renderCategoryList();
        syncCategorySelect();
      }, err => {
        catListEl.innerHTML = `<p class="updates-loading">Error: ${err.message}</p>`;
      });
  }

  function renderCategoryList() {
    if (categoryDocs.length === 0) {
      catListEl.innerHTML = `<p class="updates-loading">No categories yet. Add one above.</p>`;
      return;
    }
    catListEl.innerHTML = "";
    categoryDocs.forEach(cat => {
      const row = document.createElement("div");
      row.className = "admin-row";
      row.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px 14px; border:1px solid var(--border); border-radius:8px; margin-bottom:8px;";
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px;">
          ${cat.imageUrl ? `<img src="${escapeHtml(cat.imageUrl)}" alt="${escapeHtml(cat.name)}" style="width:48px; height:48px; object-fit:cover; border-radius:6px; border:1px solid var(--border);" onerror="this.style.display='none'" />` : `<div style="width:48px; height:48px; background:var(--border); border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:0.8rem; font-weight:700; color:var(--mist);">CAT</div>`}
          <div>
            <div><strong>${escapeHtml(cat.name)}</strong> <span class="admin-tag">${escapeHtml(cat.id)}</span> <span class="admin-tag" style="background:#fef3c7; color:#92400e;">${cat.credits} Credits</span></div>
            <p style="margin:4px 0 0; font-size:0.85rem; color:var(--mist);">${escapeHtml(cat.description || "No description provided.")}</p>
          </div>
        </div>
        <div class="admin-row-actions" style="display:flex; gap:6px; flex-shrink:0;">
          <button class="btn btn-outline btn-sm" data-edit-cat="${escapeHtml(cat.id)}">Edit</button>
          <button class="btn btn-outline btn-sm btn-danger" data-del="${escapeHtml(cat.id)}">Delete</button>
        </div>
      `;

      row.querySelector("[data-edit-cat]").addEventListener("click", () => {
        catNameInput.value = cat.name;
        catSlugInput.value = cat.id;
        if (catImageInput) catImageInput.value = cat.imageUrl || "";
        if (catCreditsInput) catCreditsInput.value = cat.credits ?? 3;
        if (catDescInput) catDescInput.value = cat.description || "";
        addCatBtn.textContent = "Save Changes to Category";
        catNameInput.scrollIntoView({ behavior: "smooth" });
      });

      row.querySelector("[data-del]").addEventListener("click", () => {
        if (confirm(`Delete category "${cat.name}" and ALL its questions? This cannot be undone.`)) {
          db.collection("premiumQuizContent").doc(cat.id).delete()
            .catch(err => alert(err.message));
        }
      });
      catListEl.appendChild(row);
    });
  }

  function syncCategorySelect() {
    const prev = qCatSelect.value;
    qCatSelect.innerHTML = `<option value="">-- Select a category --</option>`;
    categoryDocs.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = `${cat.name} (${(cat.questions || []).length} questions)`;
      qCatSelect.appendChild(opt);
    });
    if (prev && categoryDocs.find(c => c.id === prev)) {
      qCatSelect.value = prev;
    }
  }

  addCatBtn.addEventListener("click", async () => {
    const name = catNameInput.value.trim();
    const slug = catSlugInput.value.trim();
    const imageUrl = catImageInput ? catImageInput.value.trim() : "";
    const credits = catCreditsInput ? parseInt(catCreditsInput.value, 10) : 3;
    const desc = catDescInput ? catDescInput.value.trim() : "";

    if (!name || !slug) {
      catStatus.textContent = "Both name and slug are required.";
      catStatus.style.color = "crimson";
      return;
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      catStatus.textContent = "Slug must be lowercase letters, digits, and hyphens only.";
      catStatus.style.color = "crimson";
      return;
    }
    try {
      catStatus.textContent = "Saving category…";
      await db.collection("premiumQuizContent").doc(slug).set({
        name: name,
        imageUrl: imageUrl,
        description: desc,
        credits: isNaN(credits) || credits < 1 ? 3 : credits,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      catNameInput.value = "";
      catSlugInput.value = "";
      if (catImageInput) catImageInput.value = "";
      if (catCreditsInput) catCreditsInput.value = "3";
      if (catDescInput) catDescInput.value = "";
      addCatBtn.textContent = "Save / Add Category";

      catStatus.textContent = `Category "${name}" saved successfully.`;
      catStatus.style.color = "#10b981";
    } catch (err) {
      catStatus.textContent = err.message;
      catStatus.style.color = "crimson";
    }
  });

  // ---- Question CRUD (stored as array inside category doc) ----
  let currentCatQuestions = [];
  let currentCatId = "";
  let questionUnsub = null;

  qCatSelect.addEventListener("change", () => {
    currentCatId = qCatSelect.value;
    resetQForm();
    if (!currentCatId) {
      qListEl.innerHTML = `<p class="updates-loading">Select a category to view its questions.</p>`;
      return;
    }
    loadCatQuestions(currentCatId);
  });

  function loadCatQuestions(catId) {
    if (questionUnsub) questionUnsub();
    qListEl.innerHTML = `<p class="updates-loading">Loading questions…</p>`;
    questionUnsub = db.collection("premiumQuizContent").doc(catId)
      .onSnapshot(snap => {
        currentCatQuestions = snap.exists ? (snap.data().questions || []) : [];
        renderQList();
      }, err => {
        qListEl.innerHTML = `<p class="updates-loading">Error: ${err.message}</p>`;
      });
  }

  function renderQList() {
    if (currentCatQuestions.length === 0) {
      qListEl.innerHTML = `<p class="updates-loading">No questions yet for this category. Add one above.</p>`;
      return;
    }
    qListEl.innerHTML = "";
    currentCatQuestions.forEach((q, idx) => {
      const row = document.createElement("div");
      row.className = "admin-row";
      const optLetters = ["A", "B", "C", "D"];
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(q.question || "")}</strong>
          <span class="admin-tag">Correct: ${optLetters[q.correctIndex] || "?"}</span>
        </div>
        <div class="admin-row-actions">
          <button class="btn btn-outline btn-sm" data-action="edit" data-idx="${idx}">Edit</button>
          <button class="btn btn-outline btn-sm btn-danger" data-action="delete" data-idx="${idx}">Delete</button>
        </div>
      `;
      row.querySelector("[data-action='edit']").addEventListener("click", () => {
        const q2 = currentCatQuestions[idx];
        qIdField.value = String(idx);
        qTextField.value = q2.question || "";
        (q2.options || []).forEach((o, i) => { if (qOpts[i]) qOpts[i].value = o; });
        qCorrectSel.value = String(q2.correctIndex ?? 0);
        qExplField.value = q2.explanation || "";
        qSubmitBtn.textContent = "Save changes";
        cancelQBtn.hidden = false;
        qForm.scrollIntoView({ behavior: "smooth" });
      });
      row.querySelector("[data-action='delete']").addEventListener("click", async () => {
        if (!confirm("Delete this question?")) return;
        const updated = [...currentCatQuestions];
        updated.splice(idx, 1);
        try {
          await db.collection("premiumQuizContent").doc(currentCatId).update({ questions: updated });
        } catch (err) { alert(err.message); }
      });
      qListEl.appendChild(row);
    });
  }

  qForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentCatId) {
      qStatus.textContent = "Select a category first.";
      qStatus.style.color = "crimson";
      return;
    }
    const qPayload = {
      question:     qTextField.value.trim(),
      options:      qOpts.map(o => o.value.trim()),
      correctIndex: Number(qCorrectSel.value),
      explanation:  qExplField.value.trim(),
    };
    const editingIdx = qIdField.value !== "" ? parseInt(qIdField.value, 10) : -1;
    const updated = [...currentCatQuestions];

    if (editingIdx >= 0 && editingIdx < updated.length) {
      updated[editingIdx] = qPayload;
    } else {
      updated.push(qPayload);
    }

    try {
      qStatus.textContent = "Saving…";
      await db.collection("premiumQuizContent").doc(currentCatId).update({ questions: updated });
      qStatus.textContent = editingIdx >= 0 ? "Question updated successfully." : "Question added successfully.";
      qStatus.style.color = "#10b981";
      resetQForm();
    } catch (err) {
      qStatus.textContent = err.message;
      qStatus.style.color = "crimson";
    }
  });

  cancelQBtn.addEventListener("click", resetQForm);

  function resetQForm() {
    qForm.reset();
    qIdField.value = "";
    qSubmitBtn.textContent = "Add Question";
    cancelQBtn.hidden = true;
    qStatus.textContent = "";
  }

  subscribeCategories();
}

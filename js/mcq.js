/* ============================================
   mcq.js — renders the "questions" Firestore
   collection as interactive multiple-choice cards.
   Doc shape:
   {
     question: string,
     options: [string, string, string, string],
     correctIndex: number,   // 0-based index into options
     explanation: string,
     category: string,
     order: number
   }
   ============================================ */

const mcqList = document.getElementById("mcqList");
const categoryFilter = document.getElementById("categoryFilter");

let allQuestions = [];

db.collection("questions")
  .orderBy("order", "desc")
  .onSnapshot(
    (snapshot) => {
      allQuestions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderQuestions(allQuestions);
    },
    (err) => {
      mcqList.innerHTML = `<p class="updates-loading">Could not load questions (${err.message}).</p>`;
    }
  );

categoryFilter.addEventListener("input", () => {
  const q = categoryFilter.value.trim().toLowerCase();
  const filtered = q
    ? allQuestions.filter((item) => (item.category || "").toLowerCase().includes(q))
    : allQuestions;
  renderQuestions(filtered);
});

function renderQuestions(questions) {
  if (!questions.length) {
    mcqList.innerHTML = `<p class="updates-loading">No questions yet. Add some from the <a href="admin.html">Admin Panel</a>.</p>`;
    return;
  }

  mcqList.innerHTML = "";
  questions.forEach((q, qIndex) => {
    const card = document.createElement("article");
    card.className = "mcq-card";

    const options = (q.options || [])
      .map(
        (opt, i) => `<button class="mcq-option" data-index="${i}">${escapeHtml(opt)}</button>`
      )
      .join("");

    card.innerHTML = `
      ${q.category ? `<span class="mcq-category">${escapeHtml(q.category)}</span>` : ""}
      <h3>${qIndex + 1}. ${escapeHtml(q.question || "")}</h3>
      <div class="mcq-options">${options}</div>
      <p class="mcq-explanation" hidden></p>
    `;

    const optionButtons = card.querySelectorAll(".mcq-option");
    const explanationEl = card.querySelector(".mcq-explanation");

    optionButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (card.dataset.answered) return; // lock after first pick
        card.dataset.answered = "true";
        const chosen = Number(btn.dataset.index);
        optionButtons.forEach((b) => {
          const i = Number(b.dataset.index);
          if (i === q.correctIndex) b.classList.add("correct");
          else if (i === chosen) b.classList.add("incorrect");
        });
        if (q.explanation) {
          explanationEl.textContent = q.explanation;
          explanationEl.hidden = false;
        }
      });
    });

    mcqList.appendChild(card);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

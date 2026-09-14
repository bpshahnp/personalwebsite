/* ============================================================
   premium.js — Dedicated Premium Quiz Portal
   - State-driven access: Gate / Unlocked / Pending / Payment Proof Form
   - Client-side image compression for payment receipts
   - Interactive quiz runner for premium question banks
   - Weekly champion automatic unlock verification
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  // DOM Views
  const loadingView         = document.getElementById("premiumLoading");
  const authGateView        = document.getElementById("premiumAuthGate");
  const accessGrantedView   = document.getElementById("premiumAccessGranted");
  const pendingView         = document.getElementById("premiumPendingView");
  const paymentFormView     = document.getElementById("premiumPaymentFormView");

  // Auth Gate Buttons
  const gateSigninBtn       = document.getElementById("premiumGateSigninBtn");
  const gateSignupBtn       = document.getElementById("premiumGateSignupBtn");

  // Payment Form Elements
  const paymentForm         = document.getElementById("paymentProofForm");
  const payFormName         = document.getElementById("payFormName");
  const payFormPhone        = document.getElementById("payFormPhone");
  const payFormEmail        = document.getElementById("payFormEmail");
  const payFormMethod       = document.getElementById("payFormMethod");
  const payFormAmount       = document.getElementById("payFormAmount");
  const payFormRef          = document.getElementById("payFormRef");
  const payFormScreenshot   = document.getElementById("payFormScreenshot");
  const screenshotPreview   = document.getElementById("screenshotPreview");
  const payFormRemarks      = document.getElementById("payFormRemarks");
  const payFormStatus       = document.getElementById("payFormStatus");
  const payFormSubmitBtn    = document.getElementById("payFormSubmitBtn");

  // Pending View Elements
  const pendingRefCode      = document.getElementById("pendingRefCode");
  const pendingMethod       = document.getElementById("pendingMethod");
  const pendingAmount       = document.getElementById("pendingAmount");
  const pendingDate         = document.getElementById("pendingDate");
  const pendingReceiptThumbBox = document.getElementById("pendingReceiptThumbBox");
  const pendingReceiptImg   = document.getElementById("pendingReceiptImg");
  const resubmitPaymentBtn  = document.getElementById("resubmitPaymentBtn");

  // Unlocked & Quiz Arena Elements
  const categoriesSection   = document.getElementById("premiumCategoriesSection");
  const categoriesGrid      = document.getElementById("premiumCategoriesGrid");
  const quizArena           = document.getElementById("premiumQuizArena");
  const quizResults         = document.getElementById("premiumQuizResults");
  const exitQuizBtn         = document.getElementById("premiumExitQuizBtn");
  const arenaCatName        = document.getElementById("premiumArenaCatName");
  const timerBadge          = document.getElementById("premiumTimerBadge");
  const questionCounter     = document.getElementById("premiumQuestionCounter");
  const pointsCounter       = document.getElementById("premiumPointsCounter");
  const questionText        = document.getElementById("premiumQuestionText");
  const optionsGrid         = document.getElementById("premiumOptionsGrid");
  const feedbackBar         = document.getElementById("premiumFeedbackBar");
  const nextQuestionBtn     = document.getElementById("premiumNextQuestionBtn");
  const resultsFinalScore   = document.getElementById("resultsFinalScore");
  const resultsCorrectCount = document.getElementById("resultsCorrectCount");
  const resultsReturnBtn    = document.getElementById("resultsReturnBtn");
  const accessBadgeTitle    = document.getElementById("accessBadgeTitle");
  const accessBadgeSubtitle = document.getElementById("accessBadgeSubtitle");

  let currentUser = null;
  let currentUserProfile = null;
  let compressedScreenshotBase64 = "";
  let userRequestsUnsubscribe = null;
  let userProfileUnsubscribe = null;

  // Active Quiz State
  let activeQuestions = [];
  let currentQIdx = 0;
  let currentScore = 0;
  let correctCount = 0;
  let timerInterval = null;
  let secondsLeft = 20;
  const QUESTION_TIME_LIMIT = 20;
  const BASE_POINTS = 10;
  const MAX_SPEED_BONUS = 5;

  // Sound effects
  function playBeep(freq, type, duration) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch(e) {}
  }

  function showView(view) {
    [loadingView, authGateView, accessGrantedView, pendingView, paymentFormView].forEach(v => {
      if (v) v.style.display = "none";
    });
    if (view) view.style.display = "block";
  }

  // Auth gate buttons
  if (gateSigninBtn) {
    gateSigninBtn.addEventListener("click", () => {
      if (typeof window.openAuthModal === "function") {
        window.openAuthModal({ mode: "signin" });
      }
    });
  }
  if (gateSignupBtn) {
    gateSignupBtn.addEventListener("click", () => {
      if (typeof window.openAuthModal === "function") {
        window.openAuthModal({ mode: "signup" });
      }
    });
  }

  /* ---------- Screenshot Compression via Canvas ---------- */
  if (payFormScreenshot) {
    payFormScreenshot.addEventListener("change", e => {
      const file = e.target.files && e.target.files[0];
      if (!file) {
        compressedScreenshotBase64 = "";
        screenshotPreview.style.display = "none";
        return;
      }
      if (!file.type.startsWith("image/")) {
        alert("Please select a valid image file (PNG, JPG, WEBP).");
        payFormScreenshot.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = evt => {
        const img = new Image();
        img.onload = () => {
          // Scale image down to max 1000px dimension
          const maxDim = 1000;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          // Compress to JPEG 0.72 quality
          compressedScreenshotBase64 = canvas.toDataURL("image/jpeg", 0.72);
          screenshotPreview.src = compressedScreenshotBase64;
          screenshotPreview.style.display = "block";
        };
        img.src = evt.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- Payment Proof Submission ---------- */
  if (paymentForm) {
    paymentForm.addEventListener("submit", async e => {
      e.preventDefault();
      if (!currentUser) {
        alert("Please sign in first.");
        return;
      }

      const name = payFormName.value.trim();
      const phone = payFormPhone.value.trim();
      const email = payFormEmail.value.trim() || currentUser.email;
      const method = payFormMethod.value;
      const amount = Number(payFormAmount.value || 200);
      const refCode = payFormRef.value.trim();
      const remarks = payFormRemarks.value.trim();

      if (!refCode || refCode.length < 4) {
        showFormAlert("Please enter a valid payment transaction reference code.", "error");
        return;
      }

      if (!compressedScreenshotBase64) {
        showFormAlert("Please attach a screenshot of your payment receipt.", "error");
        return;
      }

      payFormSubmitBtn.disabled = true;
      payFormSubmitBtn.textContent = "Submitting verification…";
      showFormAlert("", "");

      try {
        await db.collection("premiumRequests").add({
          userId: currentUser.uid,
          userEmail: email,
          userName: name,
          userPhone: phone,
          paymentMethod: method,
          amountNpr: amount,
          referenceCode: refCode,
          screenshotUrl: compressedScreenshotBase64,
          remarks: remarks,
          status: "pending",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Clear form
        paymentForm.reset();
        compressedScreenshotBase64 = "";
        if (screenshotPreview) screenshotPreview.style.display = "none";

        // Listeners will automatically route to pending view!
      } catch (err) {
        console.error("Error submitting verification request:", err);
        showFormAlert("Failed to submit request: " + err.message, "error");
      } finally {
        payFormSubmitBtn.disabled = false;
        payFormSubmitBtn.textContent = "Submit Verification Request";
      }
    });
  }

  function showFormAlert(msg, type) {
    if (!payFormStatus) return;
    if (!msg) {
      payFormStatus.style.display = "none";
      payFormStatus.textContent = "";
      return;
    }
    payFormStatus.textContent = msg;
    payFormStatus.className = `status-alert ${type === "error" ? "warning" : "success"}`;
    payFormStatus.style.display = "block";
  }

  if (resubmitPaymentBtn) {
    resubmitPaymentBtn.addEventListener("click", () => {
      showView(paymentFormView);
    });
  }

  /* ---------- Weekly Champion Check Helper ---------- */
  async function checkIsWeeklyChampion(userId) {
    if (!userId) return false;
    try {
      // 1. Check if user already has an active unlock record
      const unlockSnap = await db.collection("premiumUnlocks").doc(userId).get();
      if (unlockSnap.exists) {
        const d = unlockSnap.data();
        if (d.unlockedUntil && d.unlockedUntil.toDate) {
          if (d.unlockedUntil.toDate() > new Date()) return true;
        } else {
          return true;
        }
      }

      // 2. Check site settings for threshold
      let threshold = 50;
      try {
        const settingsSnap = await db.collection("siteSettings").doc("liveQuiz").get();
        if (settingsSnap.exists && settingsSnap.data().premiumMinScore != null) {
          threshold = Number(settingsSnap.data().premiumMinScore);
        }
      } catch(e) {}

      // 3. Check current top score in liveQuizScores
      const scoresSnap = await db.collection("liveQuizScores")
        .orderBy("score", "desc")
        .limit(1)
        .get();

      if (!scoresSnap.empty) {
        const topDoc = scoresSnap.docs[0].data();
        if (topDoc.userId === userId && Number(topDoc.score || 0) >= threshold) {
          return true;
        }
      }
    } catch (err) {
      console.warn("Could not check tournament champion status:", err);
    }
    return false;
  }

  /* ---------- Evaluate User State & Route View ---------- */
  async function evaluateUserAccess(user) {
    if (!user) {
      showView(authGateView);
      return;
    }

    if (payFormEmail) payFormEmail.value = user.email || "";
    if (payFormName && !payFormName.value) {
      payFormName.value = user.displayName || "";
    }

    // 1. Check user profile for hasPremiumAccess
    const hasAdminAccess = currentUserProfile && currentUserProfile.hasPremiumAccess === true;
    
    // 2. Check tournament champion status
    const isChampion = await checkIsWeeklyChampion(user.uid);

    if (hasAdminAccess || isChampion) {
      if (accessBadgeTitle) {
        accessBadgeTitle.textContent = isChampion
          ? "Weekly Tournament Champion: Free Unlimited Access Unlocked!"
          : "Access Granted: Full Premium Access Unlocked";
      }
      if (accessBadgeSubtitle) {
        accessBadgeSubtitle.textContent = isChampion
          ? "Congratulations on ranking #1 with 50+ points! Enjoy your free access this week."
          : "Your account has been approved by the administrator.";
      }
      showView(accessGrantedView);
      loadCategories();
      return;
    }

    // 3. Listen to user's paymentRequests in real time
    if (userRequestsUnsubscribe) userRequestsUnsubscribe();

    userRequestsUnsubscribe = db.collection("premiumRequests")
      .where("userId", "==", user.uid)
      .onSnapshot(snap => {
        if (snap.empty) {
          showView(paymentFormView);
          return;
        }

        // Get latest request
        const docs = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
        docs.sort((a, b) => {
          const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
          const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
          return tb - ta;
        });

        const latest = docs[0];

        if (latest.status === "approved") {
          // If approved, refresh access
          showView(accessGrantedView);
          loadCategories();
        } else if (latest.status === "pending") {
          // Render pending review card
          if (pendingRefCode) pendingRefCode.textContent = latest.referenceCode || "-";
          if (pendingMethod) pendingMethod.textContent = latest.paymentMethod || "-";
          if (pendingAmount) pendingAmount.textContent = `NPR ${latest.amountNpr || 200}`;
          if (pendingDate) {
            pendingDate.textContent = latest.createdAt && latest.createdAt.toDate
              ? latest.createdAt.toDate().toLocaleString()
              : "Just now";
          }
          if (latest.screenshotUrl && pendingReceiptImg) {
            pendingReceiptImg.src = latest.screenshotUrl;
            pendingReceiptThumbBox.style.display = "block";
            pendingReceiptImg.onclick = () => {
              const w = window.open("");
              w.document.write(`<img src="${latest.screenshotUrl}" style="max-width:100%; height:auto;" />`);
            };
          } else {
            pendingReceiptThumbBox.style.display = "none";
          }
          showView(pendingView);
        } else {
          // Rejected or other -> show form with rejection message
          showView(paymentFormView);
          showFormAlert("Your previous submission was rejected. Please check your transaction details and attach a clear payment screenshot.", "error");
        }
      }, err => {
        console.error("Error listening to premium requests:", err);
        showView(paymentFormView);
      });
  }

  /* ---------- Auth State Listener ---------- */
  auth.onAuthStateChanged(async user => {
    currentUser = user;
    if (userProfileUnsubscribe) userProfileUnsubscribe();

    if (!user) {
      currentUserProfile = null;
      showView(authGateView);
      return;
    }

    // Listen to user profile changes (e.g. when admin approves hasPremiumAccess)
    userProfileUnsubscribe = db.collection("users").doc(user.uid).onSnapshot(doc => {
      if (doc.exists) {
        currentUserProfile = doc.data();
      } else {
        currentUserProfile = {};
      }
      evaluateUserAccess(user);
    }, err => {
      console.warn("Could not fetch user profile:", err);
      evaluateUserAccess(user);
    });
  });

  /* ============================================================
     Categories & Interactive Quiz Player
     ============================================================ */
  async function loadCategories() {
    if (!categoriesGrid) return;
    categoriesGrid.innerHTML = '<p class="quiz-muted">Loading categories…</p>';

    try {
      const snap = await db.collection("premiumQuizContent").get();
      if (snap.empty) {
        categoriesGrid.innerHTML = `
          <div style="grid-column:1/-1; text-align:center; padding:32px; background:#f8fafc; border-radius:12px;">
            <h3 style="margin-bottom:6px;">No Categories Available Yet</h3>
            <p style="color:#64748b; font-size:0.9rem;">The administrator hasn't added any premium categories yet. Please check back shortly!</p>
          </div>
        `;
        return;
      }

      const categories = [];
      snap.forEach(d => {
        categories.push(Object.assign({ id: d.id }, d.data()));
      });

      categoriesGrid.innerHTML = "";
      categories.forEach(cat => {
        const card = document.createElement("div");
        card.className = "category-card";

        const bgImg = cat.imageUrl ? `background-image:url('${cat.imageUrl}');` : "";
        card.innerHTML = `
          <div class="category-card-img" style="${bgImg}"></div>
          <div class="category-card-body">
            <h3 style="margin:0 0 6px; font-size:1.15rem; font-weight:700;">${escapeHtml(cat.name || "Category")}</h3>
            <p style="color:#64748b; font-size:0.85rem; line-height:1.5; flex:1; margin-bottom:16px;">
              ${escapeHtml(cat.description || "Comprehensive competitive practice questions.")}
            </p>
            <button type="button" class="btn btn-primary btn-sm start-cat-btn" style="width:100%; font-weight:700; padding:10px;">
              Start Quiz
            </button>
          </div>
        `;

        card.querySelector(".start-cat-btn").addEventListener("click", () => {
          startCategoryQuiz(cat);
        });

        categoriesGrid.appendChild(card);
      });
    } catch (err) {
      console.error("Error loading categories:", err);
      categoriesGrid.innerHTML = `<p class="quiz-muted">Could not load categories: ${err.message}</p>`;
    }
  }

  async function startCategoryQuiz(category) {
    if (!category) return;
    
    // Switch to quiz arena
    categoriesSection.style.display = "none";
    quizResults.style.display = "none";
    quizArena.style.display = "block";
    arenaCatName.textContent = category.name;
    questionText.textContent = "Loading questions…";
    optionsGrid.innerHTML = "";
    feedbackBar.style.display = "none";
    nextQuestionBtn.style.display = "none";

    try {
      const snap = await db.collection("premiumQuizContent")
        .doc(category.id)
        .collection("questions")
        .get();

      if (snap.empty) {
        questionText.textContent = "No questions have been added to this category yet.";
        return;
      }

      activeQuestions = [];
      snap.forEach(d => {
        activeQuestions.push(Object.assign({ id: d.id }, d.data()));
      });

      // Shuffle questions
      activeQuestions.sort(() => Math.random() - 0.5);

      currentQIdx = 0;
      currentScore = 0;
      correctCount = 0;
      pointsCounter.textContent = "0 pts";

      renderQuestion();
    } catch (err) {
      console.error("Error loading questions:", err);
      questionText.textContent = "Failed to load questions: " + err.message;
    }
  }

  function renderQuestion() {
    clearInterval(timerInterval);
    feedbackBar.style.display = "none";
    nextQuestionBtn.style.display = "none";

    if (currentQIdx >= activeQuestions.length) {
      finishQuiz();
      return;
    }

    const q = activeQuestions[currentQIdx];
    questionCounter.textContent = `Question ${currentQIdx + 1} of ${activeQuestions.length}`;
    questionText.textContent = q.question || "";
    optionsGrid.innerHTML = "";

    const opts = q.options || [];
    let answered = false;

    // Reset and start timer
    secondsLeft = QUESTION_TIME_LIMIT;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
      secondsLeft--;
      updateTimerDisplay();
      if (secondsLeft <= 0) {
        clearInterval(timerInterval);
        handleTimeout();
      }
    }, 1000);

    opts.forEach((optText, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mcq-opt";
      btn.style.width = "100%";
      btn.style.textAlign = "left";
      btn.style.padding = "12px 16px";
      btn.style.fontSize = "0.95rem";
      btn.style.display = "flex";
      btn.style.alignItems = "center";
      btn.style.gap = "10px";
      btn.innerHTML = `
        <span style="display:inline-flex; width:26px; height:26px; border-radius:50%; background:#f1f5f9; align-items:center; justify-content:center; font-size:0.8rem; font-weight:700; flex-shrink:0;">
          ${String.fromCharCode(65 + idx)}
        </span>
        <span>${escapeHtml(optText)}</span>
      `;

      btn.addEventListener("click", () => {
        if (answered) return;
        answered = true;
        clearInterval(timerInterval);

        const correctIdx = Number(q.correctIndex || 0);
        const isCorrect = idx === correctIdx;

        // Disable all buttons and highlight
        optionsGrid.querySelectorAll(".mcq-opt").forEach((b, i) => {
          b.disabled = true;
          if (i === correctIdx) {
            b.classList.add("is-correct");
            b.style.borderColor = "#10b981";
            b.style.background = "#ecfdf5";
          } else if (i === idx && !isCorrect) {
            b.classList.add("is-wrong");
            b.style.borderColor = "#ef4444";
            b.style.background = "#fef2f2";
          }
        });

        if (isCorrect) {
          playBeep(880, "sine", 0.2);
          correctCount++;
          const speedBonus = Math.round((secondsLeft / QUESTION_TIME_LIMIT) * MAX_SPEED_BONUS);
          const pts = BASE_POINTS + speedBonus;
          currentScore += pts;
          pointsCounter.textContent = `${currentScore} pts`;

          showFeedback(`Correct! +${BASE_POINTS} pts${speedBonus > 0 ? ` (+${speedBonus} speed bonus)` : ""}`, true, q.explanation);
        } else {
          playBeep(220, "sawtooth", 0.3);
          showFeedback(`Incorrect. Correct answer: Option ${String.fromCharCode(65 + correctIdx)}.`, false, q.explanation);
        }

        nextQuestionBtn.style.display = "inline-flex";
      });

      optionsGrid.appendChild(btn);
    });

    function handleTimeout() {
      if (answered) return;
      answered = true;
      playBeep(220, "sawtooth", 0.3);
      const correctIdx = Number(q.correctIndex || 0);

      optionsGrid.querySelectorAll(".mcq-opt").forEach((b, i) => {
        b.disabled = true;
        if (i === correctIdx) {
          b.classList.add("is-correct");
          b.style.borderColor = "#10b981";
          b.style.background = "#ecfdf5";
        }
      });

      showFeedback(`Time's up! Correct answer: Option ${String.fromCharCode(65 + correctIdx)}.`, false, q.explanation);
      nextQuestionBtn.style.display = "inline-flex";
    }
  }

  function updateTimerDisplay() {
    if (!timerBadge) return;
    timerBadge.textContent = `${secondsLeft}s`;
    if (secondsLeft <= 5) {
      timerBadge.style.background = "#fee2e2";
      timerBadge.style.color = "#dc2626";
    } else {
      timerBadge.style.background = "#f1f5f9";
      timerBadge.style.color = "#0f172a";
    }
  }

  function showFeedback(msg, isCorrect, explanation) {
    if (!feedbackBar) return;
    feedbackBar.innerHTML = `
      <strong>${escapeHtml(msg)}</strong>
      ${explanation ? `<div style="font-size:0.84rem; margin-top:4px; opacity:0.9;">${escapeHtml(explanation)}</div>` : ""}
    `;
    feedbackBar.className = `status-alert ${isCorrect ? "success" : "warning"}`;
    feedbackBar.style.display = "block";
  }

  if (nextQuestionBtn) {
    nextQuestionBtn.addEventListener("click", () => {
      currentQIdx++;
      renderQuestion();
    });
  }

  function finishQuiz() {
    clearInterval(timerInterval);
    quizArena.style.display = "none";
    quizResults.style.display = "block";

    if (resultsFinalScore) resultsFinalScore.textContent = `${currentScore} pts`;
    if (resultsCorrectCount) resultsCorrectCount.textContent = `${correctCount} / ${activeQuestions.length}`;
  }

  if (exitQuizBtn) {
    exitQuizBtn.addEventListener("click", () => {
      clearInterval(timerInterval);
      quizArena.style.display = "none";
      categoriesSection.style.display = "block";
    });
  }

  if (resultsReturnBtn) {
    resultsReturnBtn.addEventListener("click", () => {
      quizResults.style.display = "none";
      categoriesSection.style.display = "block";
    });
  }

  function escapeHtml(str) {
    if (typeof str !== "string") return String(str || "");
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
});

/* ============================================================
   premium.js — Dedicated Premium Quiz Portal
   - Catalog-first: Displays all quiz cards immediately to everyone
   - Card click gate:
       * If not signed in: prompts user to sign up / sign in
       * If signed in & sufficient credits: deducts credit and launches interactive quiz arena
       * If signed in & insufficient credits: prompts user to make payment & opens payment options
       * If signed in & pending: informs user verification is in review
   - Credit system:
       * Takes 1 credit (or category.credits) per quiz attempt
       * Updates balance in Firestore and in the UI in real time
   - Full question loading support (array on category doc or subcollection)
   - Client-side image compression for payment receipts
   - Interactive quiz runner with timed questions & instant feedback
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  // DOM Views
  const catalogView             = document.getElementById("premiumCatalogView");
  const quizArena               = document.getElementById("premiumQuizArena");
  const quizResults             = document.getElementById("premiumQuizResults");
  const pendingView             = document.getElementById("premiumPendingView");
  const paymentFormView         = document.getElementById("premiumPaymentFormView");

  // Catalog Banners & Buttons
  const catalogUnlockedBanner   = document.getElementById("catalogUnlockedBanner");
  const catalogPendingBanner    = document.getElementById("catalogPendingBanner");
  const catalogPromoBanner      = document.getElementById("catalogPromoBanner");
  const catalogPayBtn           = document.getElementById("catalogPayBtn");
  const catalogViewPendingBtn   = document.getElementById("catalogViewPendingBtn");
  const accessBadgeTitle        = document.getElementById("accessBadgeTitle");
  const accessBadgeSubtitle     = document.getElementById("accessBadgeSubtitle");
  const categoriesGrid          = document.getElementById("premiumCategoriesGrid");

  // User Credits Display
  const userCreditsDisplayWrap  = document.getElementById("userCreditsDisplayWrap");
  const userCreditsDisplay      = document.getElementById("userCreditsDisplay");

  // Navigation Back Buttons
  const exitQuizBtn             = document.getElementById("premiumExitQuizBtn");
  const resultsReturnBtn        = document.getElementById("resultsReturnBtn");
  const backToQuizzesFromPay    = document.getElementById("backToQuizzesFromPaymentBtn");
  const backToQuizzesFromPend   = document.getElementById("backToQuizzesFromPendingBtn");
  const pendingReturnToCatalog  = document.getElementById("pendingReturnToCatalogBtn");

  // Payment Form Elements
  const paymentForm             = document.getElementById("paymentProofForm");
  const payFormName             = document.getElementById("payFormName");
  const payFormPhone            = document.getElementById("payFormPhone");
  const payFormEmail            = document.getElementById("payFormEmail");
  const payFormMethod           = document.getElementById("payFormMethod");
  const payFormAmount           = document.getElementById("payFormAmount");
  const payFormRef              = document.getElementById("payFormRef");
  const payFormScreenshot       = document.getElementById("payFormScreenshot");
  const screenshotPreview       = document.getElementById("screenshotPreview");
  const payFormRemarks          = document.getElementById("payFormRemarks");
  const payFormStatus           = document.getElementById("payFormStatus");
  const payFormSubmitBtn        = document.getElementById("payFormSubmitBtn");

  // Pending View Elements
  const pendingRefCode          = document.getElementById("pendingRefCode");
  const pendingMethod           = document.getElementById("pendingMethod");
  const pendingAmount           = document.getElementById("pendingAmount");
  const pendingDate             = document.getElementById("pendingDate");
  const pendingReceiptThumbBox  = document.getElementById("pendingReceiptThumbBox");
  const pendingReceiptImg       = document.getElementById("pendingReceiptImg");
  const resubmitPaymentBtn      = document.getElementById("resubmitPaymentBtn");

  // Active Quiz Arena Elements
  const arenaCatName            = document.getElementById("premiumArenaCatName");
  const timerBadge              = document.getElementById("premiumTimerBadge");
  const questionCounter         = document.getElementById("premiumQuestionCounter");
  const pointsCounter           = document.getElementById("premiumPointsCounter");
  const questionText            = document.getElementById("premiumQuestionText");
  const optionsGrid             = document.getElementById("premiumOptionsGrid");
  const feedbackBar             = document.getElementById("feedbackBar") || document.getElementById("premiumFeedbackBar");
  const nextQuestionBtn         = document.getElementById("premiumNextQuestionBtn");
  const resultsFinalScore       = document.getElementById("resultsFinalScore");
  const resultsCorrectCount     = document.getElementById("resultsCorrectCount");
  const resultsRemainingCredits = document.getElementById("resultsRemainingCredits");

  // Prompt Modal Elements
  const promptModal             = document.getElementById("premiumPromptModal");
  const promptModalIcon         = document.getElementById("promptModalIcon");
  const promptModalTitle        = document.getElementById("promptModalTitle");
  const promptModalDesc         = document.getElementById("promptModalDesc");
  const promptModalActionBtn    = document.getElementById("promptModalActionBtn");
  const promptModalCancelBtn    = document.getElementById("promptModalCancelBtn");

  // Buy Credits Modal & Package Selection Elements
  const buyCreditsModal           = document.getElementById("buyCreditsModal");
  const buyCreditsTitle           = document.getElementById("buyCreditsTitle");
  const buyCreditsSubtitle        = document.getElementById("buyCreditsSubtitle");
  const buyCreditsCloseBtn        = document.getElementById("buyCreditsCloseBtn");
  const buyCreditsCancelBtn       = document.getElementById("buyCreditsCancelBtn");
  const buyCreditsHeaderBtn       = document.getElementById("buyCreditsHeaderBtn");
  const paymentSelectedPkgSummary = document.getElementById("paymentSelectedPkgSummary");
  const payInstructionPkgName     = document.getElementById("payInstructionPkgName");
  const payInstructionAmount      = document.getElementById("payInstructionAmount");

  // Defined Credit Packages
  const CREDIT_PACKAGES = [
    {
      id: "pack_3",
      credits: 3,
      amount: 15,
      label: "3 Credits",
      sub: "1 Quiz Attempt",
      remarks: "Purchase: 3 Credits (Rs. 15)"
    },
    {
      id: "pack_12",
      credits: 12,
      amount: 50,
      label: "12 Credits",
      sub: "4 Quiz Attempts",
      remarks: "Purchase: 12 Credits (Rs. 50)"
    },
    {
      id: "pack_30",
      credits: 30,
      amount: 100,
      label: "30 Credits",
      sub: "10 Quiz Attempts",
      remarks: "Purchase: 30 Credits (Rs. 100)"
    },
    {
      id: "pack_unlimited",
      credits: "unlimited",
      amount: 500,
      label: "1 Year Unlimited Pass",
      sub: "Whole Year Access",
      remarks: "Purchase: Annual Pass - Unlimited 1 Year (Rs. 500)"
    }
  ];

  // Global State
  let currentUser = null;
  let currentUserProfile = null;
  let userPendingRequest = null;
  let compressedScreenshotBase64 = "";
  let userRequestsUnsubscribe = null;
  let userProfileUnsubscribe = null;
  let allLoadedCategories = [];

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

  /* ---------- Sound Effects ---------- */
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

  /* ---------- View Router ---------- */
  function showView(viewName) {
    const allViews = [catalogView, quizArena, quizResults, pendingView, paymentFormView];
    allViews.forEach(v => {
      if (v) v.style.display = "none";
    });

    let target = catalogView;
    if (viewName === "arena") target = quizArena;
    else if (viewName === "results") target = quizResults;
    else if (viewName === "pending") target = pendingView;
    else if (viewName === "payment") target = paymentFormView;
    else target = catalogView;

    if (target) {
      target.style.display = "block";
      if (viewName !== "catalog") {
        window.scrollTo({ top: 120, behavior: "smooth" });
      }
    }
  }

  // Wire back buttons
  if (exitQuizBtn) exitQuizBtn.addEventListener("click", () => {
    clearInterval(timerInterval);
    showView("catalog");
  });
  if (resultsReturnBtn) resultsReturnBtn.addEventListener("click", () => showView("catalog"));
  if (backToQuizzesFromPay) backToQuizzesFromPay.addEventListener("click", () => showView("catalog"));
  if (backToQuizzesFromPend) backToQuizzesFromPend.addEventListener("click", () => showView("catalog"));
  if (pendingReturnToCatalog) pendingReturnToCatalog.addEventListener("click", () => showView("catalog"));

  

  if (catalogViewPendingBtn) {
    catalogViewPendingBtn.addEventListener("click", () => showView("pending"));
  }

  /* ---------- Prompt Modal Helper ---------- */
  function openPromptModal({ iconSvg, iconBg, iconColor, title, desc, actionText, onAction }) {
    if (!promptModal) return;
    if (promptModalIcon) {
      promptModalIcon.innerHTML = iconSvg || "";
      promptModalIcon.style.background = iconBg || "#eff6ff";
      promptModalIcon.style.color = iconColor || "#2563eb";
    }
    if (promptModalTitle) promptModalTitle.textContent = title || "";
    if (promptModalDesc) promptModalDesc.textContent = desc || "";
    if (promptModalActionBtn) {
      promptModalActionBtn.textContent = actionText || "Proceed";
      promptModalActionBtn.onclick = () => {
        closePromptModal();
        if (typeof onAction === "function") onAction();
      };
    }
    promptModal.style.display = "flex";
  }

  function closePromptModal() {
    if (promptModal) promptModal.style.display = "none";
  }

  if (promptModalCancelBtn) {
    promptModalCancelBtn.addEventListener("click", closePromptModal);
  }
  if (promptModal) {
    promptModal.addEventListener("click", (e) => {
      if (e.target === promptModal) closePromptModal();
    });
  }

  /* ---------- Credit Package Selection & Buy Modal ---------- */
  // navigateToPayment: true when called from buyCreditsModal (needs to switch view),
  //                    false when called from pills already on the payment view.
  function selectCreditPackage(pkgOrId, navigateToPayment) {
    const pkg = typeof pkgOrId === "string"
      ? (CREDIT_PACKAGES.find(p => p.id === pkgOrId) || CREDIT_PACKAGES[0])
      : (pkgOrId || CREDIT_PACKAGES[0]);

    if (payFormAmount) {
      payFormAmount.value = pkg.amount;
    }
    if (payFormRemarks) {
      payFormRemarks.value = pkg.remarks;
    }
    if (payInstructionPkgName) {
      payInstructionPkgName.textContent = pkg.label;
    }
    if (payInstructionAmount) {
      payInstructionAmount.textContent = `NPR ${pkg.amount}`;
    }
    if (paymentSelectedPkgSummary) {
      paymentSelectedPkgSummary.textContent = `${pkg.label} — Rs. ${pkg.amount}`;
    }

    // Toggle active state on package pill buttons
    document.querySelectorAll(".package-pill-btn").forEach(btn => {
      const match = btn.getAttribute("data-pkg-id") === pkg.id;
      btn.classList.toggle("active", match);
    });

    if (navigateToPayment) {
      closeBuyCreditsModal();
      showView("payment");
    }
  }

  async function openBuyCreditsModal(category, cost, userCredits) {
    if (!currentUser) {
      openPromptModal({
        iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
        iconBg: '#eff6ff',
        iconColor: '#2563eb',
        title: "Sign Up or Sign In Required",
        desc: "Please sign in or create an account first so your credits and purchases can be linked to your profile.",
        actionText: "Create Account / Sign In",
        onAction: () => {
          if (typeof window.openAuthModal === "function") {
            window.openAuthModal({ mode: "signup" });
          }
        }
      });
      return;
    }

    // Check if user already has unlimited access — warn them, no need to buy
    const hasUnlimited = await checkUserHasAccess(currentUser);
    if (hasUnlimited) {
      const isChamp = await checkIsWeeklyChampion(currentUser.uid);
      const bal = Number(currentUserProfile?.credits ?? 0);
      openPromptModal({
        iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>',
        iconBg: '#ecfdf5',
        iconColor: '#059669',
        title: "You Already Have Full Access",
        desc: isChamp
          ? "You are a Weekly Tournament Champion with unlimited free access to all premium quizzes. You do not need to purchase credits."
          : `Your account has full premium membership active. All quizzes are free for you. Your current credit balance is ${bal} credit${bal === 1 ? "" : "s"}.`,
        actionText: "Play a Quiz",
        onAction: () => showView("catalog")
      });
      return;
    }

    if (userPendingRequest && userPendingRequest.status === "pending") {
      openPromptModal({
        iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        iconBg: '#fffbeb',
        iconColor: '#d97706',
        title: "Verification Under Review",
        desc: `You currently have ${userCredits ?? (currentUserProfile?.credits ?? 0)} credits. Your payment verification request is currently awaiting administrator review.`,
        actionText: "View Submission Details",
        onAction: () => showView("pending")
      });
      return;
    }

    if (buyCreditsSubtitle) {
      if (category) {
        const required = cost || 3;
        const current = userCredits ?? (currentUserProfile?.credits ?? 0);
        buyCreditsSubtitle.innerHTML = `"${escapeHtml(category.name || 'This quiz')}" requires <strong>${required} credits</strong> (you currently have <strong>${current}</strong>). Select a credit package below:`;
      } else {
        buyCreditsSubtitle.innerHTML = `Each quiz requires <strong>3 credits</strong> to play. Select a package below to top up your balance:`;
      }
    }

    if (buyCreditsModal) buyCreditsModal.style.display = "flex";
  }

  function closeBuyCreditsModal() {
    if (buyCreditsModal) buyCreditsModal.style.display = "none";
  }

  if (buyCreditsCloseBtn) buyCreditsCloseBtn.addEventListener("click", closeBuyCreditsModal);
  if (buyCreditsCancelBtn) buyCreditsCancelBtn.addEventListener("click", closeBuyCreditsModal);
  if (buyCreditsModal) {
    buyCreditsModal.addEventListener("click", (e) => {
      if (e.target === buyCreditsModal) closeBuyCreditsModal();
    });
  }

  // Wire package cards in buyCreditsModal — navigate to payment view on click
  document.querySelectorAll(".credit-pack-card").forEach(card => {
    card.addEventListener("click", () => {
      const pkgId = card.getAttribute("data-pkg-id");
      selectCreditPackage(pkgId, true);
    });
  });

  // Wire package pills in payment view — already on payment view, just update fields in place
  document.querySelectorAll(".package-pill-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const pkgId = btn.getAttribute("data-pkg-id");
      selectCreditPackage(pkgId, false);
    });
  });

  // Wire Catalog Pay button and Header Buy button
  if (catalogPayBtn) {
    catalogPayBtn.addEventListener("click", () => {
      openBuyCreditsModal();
    });
  }
  if (buyCreditsHeaderBtn) {
    buyCreditsHeaderBtn.addEventListener("click", () => {
      openBuyCreditsModal();
    });
  }

  /* ---------- Update Credit Balance in UI ---------- */
  function updateUserCreditsUI(credits) {
    const bal = typeof credits === "number" ? credits : 0;
    if (userCreditsDisplay) {
      userCreditsDisplay.textContent = `${bal} Credit${bal === 1 ? "" : "s"}`;
    }
    if (userCreditsDisplayWrap) {
      userCreditsDisplayWrap.style.display = currentUser ? "inline-flex" : "none";
    }
    // Also sync dropdown credit elements across the page
    document.querySelectorAll(".user-credits-val").forEach(el => {
      el.textContent = bal;
    });
  }

  /* ---------- Screenshot Compression via Canvas ---------- */
  if (payFormScreenshot) {
    payFormScreenshot.addEventListener("change", e => {
      const file = e.target.files && e.target.files[0];
      if (!file) {
        compressedScreenshotBase64 = "";
        if (screenshotPreview) screenshotPreview.style.display = "none";
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
          if (screenshotPreview) {
            screenshotPreview.src = compressedScreenshotBase64;
            screenshotPreview.style.display = "block";
          }
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
        alert("Please sign in or create an account first.");
        if (typeof window.openAuthModal === "function") {
          window.openAuthModal({ mode: "signup" });
        }
        return;
      }

      const name = payFormName ? payFormName.value.trim() : "";
      const phone = payFormPhone ? payFormPhone.value.trim() : "";
      const email = (payFormEmail && payFormEmail.value.trim()) || currentUser.email || "";
      const method = payFormMethod ? payFormMethod.value : "eSewa";
      const amount = Number((payFormAmount && payFormAmount.value) || 15);
      const refCode = payFormRef ? payFormRef.value.trim() : "";
      const remarks = payFormRemarks ? payFormRemarks.value.trim() : "";

      if (!refCode || refCode.length < 4) {
        showFormAlert("Please enter a valid payment transaction reference code.", "error");
        return;
      }

      if (!compressedScreenshotBase64) {
        showFormAlert("Please attach a screenshot of your payment receipt.", "error");
        return;
      }

      if (payFormSubmitBtn) {
        payFormSubmitBtn.disabled = true;
        payFormSubmitBtn.textContent = "Submitting verification…";
      }
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

        alert("Payment verification submitted successfully! Your account will be verified by the administrator.");
        showView("pending");
      } catch (err) {
        console.error("Error submitting verification request:", err);
        showFormAlert("Failed to submit request: " + err.message, "error");
      } finally {
        if (payFormSubmitBtn) {
          payFormSubmitBtn.disabled = false;
          payFormSubmitBtn.textContent = "Submit Verification Request";
        }
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
      showView("payment");
    });
  }

  /* ---------- Weekly Champion Check Helper ---------- */
  async function checkIsWeeklyChampion(userId) {
    if (!userId || !db) return false;
    try {
      const unlockSnap = await db.collection("premiumUnlocks").doc(userId).get();
      if (unlockSnap.exists) {
        const d = unlockSnap.data();
        if (d.unlockedUntil && d.unlockedUntil.toDate) {
          if (d.unlockedUntil.toDate() > new Date()) return true;
        } else {
          return true;
        }
      }

      let threshold = 50;
      try {
        const settingsSnap = await db.collection("siteSettings").doc("liveQuiz").get();
        if (settingsSnap.exists && settingsSnap.data().premiumMinScore != null) {
          threshold = Number(settingsSnap.data().premiumMinScore);
        }
      } catch(e) {}

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

  /* ---------- Access Check Helper ---------- */
  async function checkUserHasAccess(user) {
    if (!user) return false;
    if (currentUserProfile && currentUserProfile.hasPremiumAccess === true) {
      return true;
    }
    const isChamp = await checkIsWeeklyChampion(user.uid);
    if (isChamp) return true;
    return false;
  }

  /* ---------- Sync Banners based on User State ---------- */
  async function syncUserStatusBanners() {
    if (!currentUser) {
      if (catalogUnlockedBanner) catalogUnlockedBanner.style.display = "none";
      if (catalogPendingBanner) catalogPendingBanner.style.display = "none";
      if (catalogPromoBanner) catalogPromoBanner.style.display = "flex";
      updateUserCreditsUI(0);
      return;
    }

    const credits = Number(currentUserProfile?.credits ?? 0);
    updateUserCreditsUI(credits);

    const hasAccess = await checkUserHasAccess(currentUser);
    if (hasAccess) {
      const isChamp = await checkIsWeeklyChampion(currentUser.uid);
      if (accessBadgeTitle) {
        accessBadgeTitle.textContent = isChamp
          ? "Weekly Tournament Champion: Unlimited Access Unlocked!"
          : "Access Granted: Full Premium Membership Active";
      }
      if (accessBadgeSubtitle) {
        accessBadgeSubtitle.textContent = isChamp
          ? "Congratulations on ranking #1 in the weekly tournament! Practice all competitive categories freely."
          : `Your account has full access. Current balance: ${credits} credit${credits === 1 ? "" : "s"}.`;
      }
      if (catalogUnlockedBanner) catalogUnlockedBanner.style.display = "flex";
      if (catalogPendingBanner) catalogPendingBanner.style.display = "none";
      if (catalogPromoBanner) catalogPromoBanner.style.display = "none";
      return;
    }

    if (userPendingRequest && userPendingRequest.status === "pending") {
      if (catalogUnlockedBanner) catalogUnlockedBanner.style.display = "none";
      if (catalogPendingBanner) catalogPendingBanner.style.display = "flex";
      if (catalogPromoBanner) catalogPromoBanner.style.display = "none";
      return;
    }

    // Unpaid / default
    if (catalogUnlockedBanner) catalogUnlockedBanner.style.display = "none";
    if (catalogPendingBanner) catalogPendingBanner.style.display = "none";
    if (catalogPromoBanner) catalogPromoBanner.style.display = "flex";
  }

  /* ---------- Auth State Listener ---------- */
  if (typeof auth !== "undefined" && auth) {
    auth.onAuthStateChanged(async user => {
      currentUser = user;
      if (userProfileUnsubscribe) userProfileUnsubscribe();
      if (userRequestsUnsubscribe) userRequestsUnsubscribe();

      if (!user) {
        currentUserProfile = null;
        userPendingRequest = null;
        syncUserStatusBanners();
        return;
      }

      if (payFormEmail) payFormEmail.value = user.email || "";
      if (payFormName && !payFormName.value) {
        payFormName.value = user.displayName || "";
      }

      // 1. Listen to user profile doc
      if (db) {
        userProfileUnsubscribe = db.collection("users").doc(user.uid).onSnapshot(doc => {
          currentUserProfile = doc.exists ? doc.data() : {};
          syncUserStatusBanners();
        }, err => {
          console.warn("Could not fetch user profile:", err);
          syncUserStatusBanners();
        });

        // 2. Listen to payment requests for this user
        userRequestsUnsubscribe = db.collection("premiumRequests")
          .where("userId", "==", user.uid)
          .onSnapshot(snap => {
            if (snap.empty) {
              userPendingRequest = null;
              syncUserStatusBanners();
              return;
            }

            const docs = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
            docs.sort((a, b) => {
              const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
              const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
              return tb - ta;
            });

            const latest = docs[0];
            userPendingRequest = latest;

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
              if (pendingReceiptThumbBox) pendingReceiptThumbBox.style.display = "block";
              pendingReceiptImg.onclick = () => {
                const w = window.open("");
                w.document.write(`<img src="${latest.screenshotUrl}" style="max-width:100%; height:auto;" />`);
              };
            } else {
              if (pendingReceiptThumbBox) pendingReceiptThumbBox.style.display = "none";
            }

            syncUserStatusBanners();
          }, err => {
            console.warn("Error listening to user payment requests:", err);
            syncUserStatusBanners();
          });
      }
    });
  }

  /* ============================================================
     Categories Loader & Card Renderer
     Always runs immediately so quiz cards are shown first!
     ============================================================ */
  async function loadCategories() {
    if (!categoriesGrid) return;
    categoriesGrid.innerHTML = '<p class="quiz-muted">Loading available premium quizzes…</p>';

    try {
      const snap = await db.collection("premiumQuizContent").get();
      if (snap.empty) {
        categoriesGrid.innerHTML = `
          <div style="grid-column:1/-1; text-align:center; padding:40px 20px; background:#fff; border:1px solid #e2e8f0; border-radius:14px;">
            <h3 style="margin-bottom:8px; font-size:1.2rem;">No Quizzes Published Yet</h3>
            <p style="color:#64748b; font-size:0.92rem; max-width:480px; margin:0 auto;">
              The administrator has not added any premium quizzes yet. Please check back shortly or check out the Live Quiz and MCQ Hub!
            </p>
          </div>
        `;
        return;
      }

      allLoadedCategories = [];
      snap.forEach(d => {
        allLoadedCategories.push(Object.assign({ id: d.id }, d.data()));
      });

      // Sort alphabetically by category name
      allLoadedCategories.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

      categoriesGrid.innerHTML = "";
      allLoadedCategories.forEach(cat => {
        const card = document.createElement("div");
        card.className = "category-card";

        const bgImg = cat.imageUrl
          ? `background-image:url('${escapeHtml(cat.imageUrl)}');`
          : "background: linear-gradient(135deg, #1e293b 0%, #3b82f6 100%);";
        
        const qCount = Array.isArray(cat.questions) ? cat.questions.length : (cat.questionCount || 0);
        const cost = Math.max(1, Number(cat.credits || 3));
        const countBadge = qCount > 0 ? `${qCount} Qs · ${cost} Credits` : `${cost} Credits`;

        card.innerHTML = `
          <div class="category-card-img" style="${bgImg}">
            <span class="category-card-badge">${escapeHtml(countBadge)}</span>
          </div>
          <div class="category-card-body">
            <h3 style="margin:0 0 8px; font-size:1.15rem; font-weight:700;">${escapeHtml(cat.name || "Premium Quiz")}</h3>
            <p style="color:#64748b; font-size:0.86rem; line-height:1.55; flex:1; margin-bottom:18px;">
              ${escapeHtml(cat.description || "Comprehensive timed competitive examination practice questions.")}
            </p>
            <button type="button" class="btn btn-primary btn-sm start-cat-btn" style="width:100%; font-weight:700; padding:11px 16px; display:flex; align-items:center; justify-content:center; gap:8px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <span>Play Quiz (${cost} Credits)</span>
            </button>
          </div>
        `;

        card.querySelector(".start-cat-btn").addEventListener("click", (e) => {
          e.stopPropagation();
          handleQuizCardClick(cat);
        });
        card.addEventListener("click", () => {
          handleQuizCardClick(cat);
        });

        categoriesGrid.appendChild(card);
      });
    } catch (err) {
      console.error("Error loading categories:", err);
      categoriesGrid.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:32px; background:#fef2f2; border:1px solid #fecaca; border-radius:12px;">
          <p style="color:#dc2626; font-size:0.95rem; margin:0;">Could not load quizzes: ${escapeHtml(err.message)}</p>
        </div>
      `;
    }
  }

  /* ============================================================
     Quiz Card Click Handler (Gate: Sign Up -> Credit Check/Deduction -> Pay/Play)
     ============================================================ */
  async function handleQuizCardClick(category) {
    if (!category) return;

    // 1. If user is NOT signed in: ask them to first signup/signin
    if (!currentUser) {
      openPromptModal({
        iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
        iconBg: '#eff6ff',
        iconColor: '#2563eb',
        title: "Account Required",
        desc: `To play or try "${category.name || 'this quiz'}", please create a free account or sign in first.`,
        actionText: "Sign Up / Sign In",
        onAction: () => {
          if (typeof window.openAuthModal === "function") {
            window.openAuthModal({ mode: "signup" });
          }
        }
      });
      return;
    }

    // Check if user has unlimited access (admin-granted or weekly tournament champion)
    const hasUnlimited = await checkUserHasAccess(currentUser);
    if (hasUnlimited) {
      startCategoryQuiz(category, "Unlimited");
      return;
    }

    const cost = Math.max(1, Number(category.credits || 3));
    const userCredits = Number(currentUserProfile?.credits ?? 0);

    // 2. Check if user has enough credits
    if (userCredits >= cost) {
      // User has enough credits! Confirm starting quiz and deducting credits
      openPromptModal({
        iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>',
        iconBg: '#ecfdf5',
        iconColor: '#059669',
        title: `Start "${category.name}"`,
        desc: `Starting this quiz will use ${cost} credit${cost > 1 ? "s" : ""}. You currently have ${userCredits} credit${userCredits === 1 ? "" : "s"} (${userCredits - cost} remaining after this quiz).`,
        actionText: `Start Quiz (-${cost} Credit${cost > 1 ? "s" : ""})`,
        onAction: async () => {
          // Deduct credit in Firestore
          try {
            await db.collection("users").doc(currentUser.uid).set({
              credits: firebase.firestore.FieldValue.increment(-cost),
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // Update local state and UI immediately
            const newBal = Math.max(0, userCredits - cost);
            if (currentUserProfile) currentUserProfile.credits = newBal;
            updateUserCreditsUI(newBal);

            // Start quiz
            startCategoryQuiz(category, newBal);
          } catch (err) {
            console.error("Error deducting credit:", err);
            alert("Could not deduct credit: " + err.message);
          }
        }
      });
      return;
    }

    // 3. User does NOT have enough credits (< cost)
    // Check if user has a pending verification request
    if (userPendingRequest && userPendingRequest.status === "pending") {
      openPromptModal({
        iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        iconBg: '#fffbeb',
        iconColor: '#d97706',
        title: "Verification Under Review",
        desc: `You currently have ${userCredits} credit${userCredits === 1 ? "" : "s"}. Your payment verification request is currently awaiting administrator review to top up your credits.`,
        actionText: "View Submission Details",
        onAction: () => {
          showView("pending");
        }
      });
      return;
    }

    // 4. Insufficient credits & no pending payment -> Show credit purchase packages directly!
    openBuyCreditsModal(category, cost, userCredits);
  }

  /* ============================================================
     Interactive Quiz Arena Runner
     ============================================================ */
  async function startCategoryQuiz(category, remainingCredits) {
    if (!category) return;
    
    // Switch view to arena
    showView("arena");
    const creditsLabel = typeof remainingCredits === "number"
      ? ` (${remainingCredits} credit${remainingCredits === 1 ? "" : "s"} remaining)`
      : (remainingCredits === "Unlimited" ? " (Unlimited Access)" : "");
    if (arenaCatName) arenaCatName.textContent = `${category.name || "Premium Quiz"}${creditsLabel}`;
    if (questionText) questionText.textContent = "Loading questions…";
    if (optionsGrid) optionsGrid.innerHTML = "";
    if (feedbackBar) feedbackBar.style.display = "none";
    if (nextQuestionBtn) nextQuestionBtn.style.display = "none";

    try {
      activeQuestions = [];

      // Case A: Questions stored in array on the category document (Admin manager format)
      if (Array.isArray(category.questions) && category.questions.length > 0) {
        activeQuestions = [...category.questions];
      } else {
        const docSnap = await db.collection("premiumQuizContent").doc(category.id).get();
        if (docSnap.exists && Array.isArray(docSnap.data().questions) && docSnap.data().questions.length > 0) {
          activeQuestions = [...docSnap.data().questions];
        } else {
          const subSnap = await db.collection("premiumQuizContent").doc(category.id).collection("questions").get();
          if (!subSnap.empty) {
            subSnap.forEach(d => activeQuestions.push(Object.assign({ id: d.id }, d.data())));
          }
        }
      }

      if (activeQuestions.length === 0) {
        if (questionText) {
          questionText.textContent = "No questions have been published for this category yet. Please check back soon!";
        }
        return;
      }

      // Shuffle questions for varied practice
      activeQuestions.sort(() => Math.random() - 0.5);

      currentQIdx = 0;
      currentScore = 0;
      correctCount = 0;
      if (pointsCounter) pointsCounter.textContent = "0 pts";

      renderQuestion();
    } catch (err) {
      console.error("Error loading questions for quiz:", err);
      if (questionText) questionText.textContent = "Failed to load questions: " + err.message;
    }
  }

  function renderQuestion() {
    clearInterval(timerInterval);
    if (feedbackBar) feedbackBar.style.display = "none";
    if (nextQuestionBtn) nextQuestionBtn.style.display = "none";

    if (currentQIdx >= activeQuestions.length) {
      finishQuiz();
      return;
    }

    const q = activeQuestions[currentQIdx];
    if (questionCounter) questionCounter.textContent = `Question ${currentQIdx + 1} of ${activeQuestions.length}`;
    if (questionText) questionText.textContent = q.question || "";
    if (optionsGrid) optionsGrid.innerHTML = "";

    const opts = q.options || [];
    let answered = false;

    // Reset and start countdown timer
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
      btn.style.padding = "13px 16px";
      btn.style.fontSize = "0.95rem";
      btn.style.display = "flex";
      btn.style.alignItems = "center";
      btn.style.gap = "12px";
      btn.style.borderRadius = "10px";
      btn.style.border = "1px solid var(--line, #cbd5e1)";
      btn.style.background = "var(--bg, #fff)";
      btn.style.cursor = "pointer";
      btn.style.transition = "all 0.15s ease";
      btn.innerHTML = `
        <span style="display:inline-flex; width:28px; height:28px; border-radius:50%; background:#f1f5f9; color:#0f172a; align-items:center; justify-content:center; font-size:0.82rem; font-weight:800; flex-shrink:0;">
          ${String.fromCharCode(65 + idx)}
        </span>
        <span style="flex:1;">${escapeHtml(optText)}</span>
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
          b.style.cursor = "default";
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
          playBeep(880, "sine", 0.18);
          correctCount++;
          const speedBonus = Math.round((secondsLeft / QUESTION_TIME_LIMIT) * MAX_SPEED_BONUS);
          const pts = BASE_POINTS + speedBonus;
          currentScore += pts;
          if (pointsCounter) pointsCounter.textContent = `${currentScore} pts`;

          showFeedback(`Correct! +${BASE_POINTS} pts${speedBonus > 0 ? ` (+${speedBonus} speed bonus)` : ""}`, true, q.explanation);
        } else {
          playBeep(220, "sawtooth", 0.28);
          showFeedback(`Incorrect. Correct answer: Option ${String.fromCharCode(65 + correctIdx)}.`, false, q.explanation);
        }

        if (nextQuestionBtn) nextQuestionBtn.style.display = "inline-flex";
      });

      optionsGrid.appendChild(btn);
    });

    function handleTimeout() {
      if (answered) return;
      answered = true;
      playBeep(220, "sawtooth", 0.28);
      const correctIdx = Number(q.correctIndex || 0);

      optionsGrid.querySelectorAll(".mcq-opt").forEach((b, i) => {
        b.disabled = true;
        b.style.cursor = "default";
        if (i === correctIdx) {
          b.classList.add("is-correct");
          b.style.borderColor = "#10b981";
          b.style.background = "#ecfdf5";
        }
      });

      showFeedback(`Time's up! Correct answer: Option ${String.fromCharCode(65 + correctIdx)}.`, false, q.explanation);
      if (nextQuestionBtn) nextQuestionBtn.style.display = "inline-flex";
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
    showView("results");

    if (resultsFinalScore) resultsFinalScore.textContent = `${currentScore} pts`;
    if (resultsCorrectCount) resultsCorrectCount.textContent = `${correctCount} / ${activeQuestions.length}`;
    if (resultsRemainingCredits) {
      const bal = currentUserProfile && currentUserProfile.credits != null
        ? currentUserProfile.credits
        : 0;
      resultsRemainingCredits.textContent = `${bal}`;
    }
  }

  /* ---------- Utility: HTML Escaping ---------- */
  function escapeHtml(str) {
    if (typeof str !== "string") return String(str ?? "");
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Initial call: load categories immediately on page load!
  showView("catalog");
  loadCategories();
});

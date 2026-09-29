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
  const categoryChipsWrap       = document.getElementById("premiumCategoryChips");

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

  // Quiz Share Modal Elements
  const quizShareModal            = document.getElementById("quizShareModal");
  const shareModalCloseBtn        = document.getElementById("shareModalCloseBtn");
  const shareModalCopyBtn         = document.getElementById("shareModalCopyBtn");

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
  let currentUnlimitedAccess = false;
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
    if (promptModalDesc) promptModalDesc.innerHTML = desc || "";
    if (promptModalActionBtn) {
      promptModalActionBtn.textContent = actionText || "Proceed";
      promptModalActionBtn.onclick = () => {
        closePromptModal();
        if (typeof onAction === "function") onAction();
      };
    }
    promptModal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }

  function closePromptModal() {
    if (promptModal) promptModal.style.display = "none";
    document.body.style.overflow = "";
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
        buyCreditsSubtitle.innerHTML = `Each quiz requires <strong>some credits</strong> to play. Select a package below to top up your balance:`;
      }
    }

    if (buyCreditsModal) {
      buyCreditsModal.style.display = "flex";
      document.body.style.overflow = "hidden";
    }
  }

  function closeBuyCreditsModal() {
    if (buyCreditsModal) buyCreditsModal.style.display = "none";
    document.body.style.overflow = "";
  }

  if (buyCreditsCloseBtn) buyCreditsCloseBtn.addEventListener("click", closeBuyCreditsModal);
  if (buyCreditsCancelBtn) buyCreditsCancelBtn.addEventListener("click", closeBuyCreditsModal);
  if (buyCreditsModal) {
    buyCreditsModal.addEventListener("click", (e) => {
      if (e.target === buyCreditsModal) closeBuyCreditsModal();
    });
  }

  /* ---------- Quiz Share Modal & Social Deep-Linking ---------- */
  /**
   * Returns the share URL for a quiz card.
   * Points to quiz-share.html?id=<quizId> so:
   *   - Social crawlers (FB, WhatsApp, Twitter, etc.) hit the page and
   *     get a Cloudflare Worker that injects the quiz's own image as og:image
   *   - Regular users are auto-redirected from quiz-share.html to
   *     premium.html?quiz=<id> which launches the quiz directly
   */
  function getQuizShareUrl(cat) {
    if (!cat) return window.location.href;
    try {
      const origin = window.location.origin && window.location.origin !== "null"
        ? window.location.origin
        : "https://bholaprasadshah.com.np";
      // Build quiz-share.html URL in the same directory as the current page
      let dir = window.location.pathname.replace(/\/[^/]*$/, "") || "";
      const url = new URL(dir + "/quiz-share.html", origin);
      url.searchParams.set("id", cat.id);
      if (cat.name) {
        url.searchParams.set("t", cat.name.trim());
      }
      if (cat.imageUrl && /^https?:\/\//i.test(cat.imageUrl.trim())) {
        url.searchParams.set("img", cat.imageUrl.trim());
      }
      if (cat.description) {
        const shortDesc = cat.description.trim().slice(0, 140);
        url.searchParams.set("d", shortDesc);
      }
      url.hash = "";
      return url.toString();
    } catch (_) {
      let fallback = `https://bholaprasadshah.com.np/quiz-share.html?id=${encodeURIComponent(cat.id)}`;
      if (cat.name) fallback += `&t=${encodeURIComponent(cat.name.trim())}`;
      if (cat.imageUrl) fallback += `&img=${encodeURIComponent(cat.imageUrl.trim())}`;
      return fallback;
    }
  }

  function openQuizShareModal(cat) {
    if (!cat || !quizShareModal) return;

    const shareUrl = getQuizShareUrl(cat);
    const qCount = Array.isArray(cat.questions) ? cat.questions.length : (cat.questionCount || 0);
    const cost = Math.max(1, Number(cat.credits || 3));
    const catLevel = getQuizCategoryLevel(cat);

    const previewName     = document.getElementById("shareModalQuizName");
    const previewLevel    = document.getElementById("shareModalQuizLevel");
    const previewMeta     = document.getElementById("shareModalQuizMeta");
    const previewThumb    = document.getElementById("shareModalQuizThumb");
    const previewFallback = document.getElementById("shareModalQuizThumbFallback");
    const directLinkInput = document.getElementById("shareModalDirectLink");
    const copyText        = document.getElementById("shareCopyText");
    const copyIcon        = document.getElementById("shareCopyIcon");

    if (previewName) previewName.textContent = cat.name || "Premium Quiz";
    if (previewLevel) previewLevel.textContent = catLevel;
    if (previewMeta) previewMeta.textContent = `${qCount > 0 ? qCount + " Questions · " : ""}${cost} Credit${cost === 1 ? "" : "s"}`;
    if (directLinkInput) directLinkInput.value = shareUrl;
    if (copyText) copyText.textContent = "Copy";
    if (copyIcon) copyIcon.innerHTML = '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>';

    // Set quiz image in preview thumbnail
    if (previewThumb) {
      if (cat.imageUrl) {
        previewThumb.style.backgroundImage = `url('${escapeHtml(cat.imageUrl)}')`;
        previewThumb.style.backgroundSize  = "cover";
        previewThumb.style.backgroundPosition = "center";
        previewThumb.style.background = `url('${escapeHtml(cat.imageUrl)}') center/cover no-repeat`;
        if (previewFallback) previewFallback.style.display = "none";
      } else {
        previewThumb.style.backgroundImage = "";
        previewThumb.style.background = "linear-gradient(135deg, #1e293b 0%, #3b82f6 100%)";
        if (previewFallback) previewFallback.style.display = "flex";
      }
    }

    const shareTitle = `Challenge: "${cat.name || 'Premium Quiz'}"`;
    const shareText = `Can you beat this quiz: "${cat.name || 'Premium Quiz'}"? Test your knowledge now on B. Prasad Shah's Portal!`;

    // 1. WhatsApp
    const btnWhatsapp = document.getElementById("shareBtnWhatsapp");
    if (btnWhatsapp) {
      btnWhatsapp.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + "\n" + shareUrl)}`;
    }
    // 2. Facebook
    const btnFacebook = document.getElementById("shareBtnFacebook");
    if (btnFacebook) {
      btnFacebook.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    }
    // 3. Twitter / X
    const btnTwitter = document.getElementById("shareBtnTwitter");
    if (btnTwitter) {
      btnTwitter.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    }
    // 4. LinkedIn
    const btnLinkedin = document.getElementById("shareBtnLinkedin");
    if (btnLinkedin) {
      btnLinkedin.href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    }
    // 5. Telegram
    const btnTelegram = document.getElementById("shareBtnTelegram");
    if (btnTelegram) {
      btnTelegram.href = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
    }

    // Native mobile share button (if supported)
    const nativeShareWrap = document.getElementById("shareModalNativeWrap");
    const nativeShareBtn  = document.getElementById("shareModalNativeBtn");
    if (navigator.share && nativeShareWrap && nativeShareBtn) {
      nativeShareWrap.style.display = "block";
      nativeShareBtn.onclick = async () => {
        try {
          await navigator.share({
            title: shareTitle,
            text: shareText,
            url: shareUrl
          });
        } catch (_) {}
      };
    } else if (nativeShareWrap) {
      nativeShareWrap.style.display = "none";
    }

    quizShareModal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }

  function closeQuizShareModal() {
    if (quizShareModal) quizShareModal.style.display = "none";
    document.body.style.overflow = "";
  }

  if (shareModalCloseBtn) shareModalCloseBtn.addEventListener("click", closeQuizShareModal);
  if (quizShareModal) {
    quizShareModal.addEventListener("click", (e) => {
      if (e.target === quizShareModal) closeQuizShareModal();
    });
  }
  if (shareModalCopyBtn) {
    shareModalCopyBtn.addEventListener("click", async () => {
      const directLinkInput = document.getElementById("shareModalDirectLink");
      const copyText        = document.getElementById("shareCopyText");
      const copyIcon        = document.getElementById("shareCopyIcon");
      if (!directLinkInput) return;

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(directLinkInput.value);
        } else {
          directLinkInput.select();
          document.execCommand("copy");
        }
        if (copyText) copyText.textContent = "Copied!";
        if (copyIcon) copyIcon.innerHTML = '<polyline points="20 6 9 17 4 12" stroke-width="2.5"></polyline>';
        setTimeout(() => {
          if (copyText) copyText.textContent = "Copy";
          if (copyIcon) copyIcon.innerHTML = '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>';
        }, 2200);
      } catch (err) {
        console.warn("Copy link failed:", err);
      }
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
    const isUnlimited = credits === "Unlimited";
    const bal = isUnlimited ? "Unlimited" : (typeof credits === "number" ? credits : 0);
    if (userCreditsDisplay) {
      userCreditsDisplay.textContent = isUnlimited
        ? "Unlimited Credits"
        : `${bal} Credit${bal === 1 ? "" : "s"}`;
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
      // 1. Calculate current week key (e.g. 2026-W38)
      const now = new Date();
      const localDay = now.getDay();
      const dayNr = localDay === 0 ? 7 : localDay;
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      target.setDate(target.getDate() + 4 - dayNr);
      const yearStart = new Date(target.getFullYear(), 0, 1);
      const weekNo = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
      const pad = (n) => String(n).padStart(2, "0");
      const currentWeekKey = `${target.getFullYear()}-W${pad(weekNo)}`;

      // 2. Check direct user unlock doc (premiumUnlocks/USER_ID)
      //    and weekly unlock doc (premiumUnlocks/USER_ID_WEEK_KEY)
      const [userSnap, weekSnap] = await Promise.all([
        db.collection("premiumUnlocks").doc(userId).get(),
        db.collection("premiumUnlocks").doc(`${userId}_${currentWeekKey}`).get()
      ]);

      const unlockDoc = weekSnap.exists ? weekSnap.data() : (userSnap.exists ? userSnap.data() : null);
      if (unlockDoc) {
        if (unlockDoc.unlockedUntil && unlockDoc.unlockedUntil.toDate) {
          if (unlockDoc.unlockedUntil.toDate() > new Date()) return true;
        } else {
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
      // Show "Unlimited Credits" in the header for users with unlimited access
      updateUserCreditsUI("Unlimited");
      const isChamp = await checkIsWeeklyChampion(currentUser.uid);
      if (accessBadgeTitle) {
        accessBadgeTitle.textContent = isChamp
          ? "Weekly Tournament Champion: Unlimited Access Unlocked!"
          : "Access Granted: Full Premium Membership Active";
      }
      if (accessBadgeSubtitle) {
        accessBadgeSubtitle.textContent = isChamp
          ? "Congratulations on ranking #1 in the weekly tournament! Practice all competitive categories freely."
          : `Your account has full access. Unlimited credits available.`;
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
          if (allLoadedCategories && allLoadedCategories.length > 0) {
            checkAndHandleDeepLinkQuiz();
          }
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
     Categories & Level Filter System
     - Supports: Beginners Level, Intermediate Level, Higher Level, Loksewa, + Custom
     - Changeable dynamically from Admin via siteSettings/premiumCategories
     - Filter chips update card grid in real time with count badges
     ============================================================ */
  const DEFAULT_PREMIUM_LEVELS = ["Beginners Level", "Intermediate Level", "Higher Level", "Loksewa"];
  let configuredCategories = [...DEFAULT_PREMIUM_LEVELS];
  let activeCategoryFilter = "all";

  function getQuizCategoryLevel(cat) {
    if (cat && cat.category && String(cat.category).trim()) return String(cat.category).trim();
    if (cat && cat.level && String(cat.level).trim()) return String(cat.level).trim();
    const name = (cat && cat.name ? cat.name : "").toLowerCase();
    if (name.includes("beginner")) return "Beginners Level";
    if (name.includes("intermediate")) return "Intermediate Level";
    if (name.includes("higher") || name.includes("advanced")) return "Higher Level";
    if (name.includes("loksewa") || name.includes("lok sewa")) return "Loksewa";
    return "Beginners Level";
  }

  // Subscribe to category definitions from admin
  function subscribeConfiguredCategories() {
    db.collection("siteSettings").doc("premiumCategories")
      .onSnapshot(doc => {
        if (doc.exists && Array.isArray(doc.data().list) && doc.data().list.length > 0) {
          configuredCategories = doc.data().list.filter(Boolean);
        } else {
          configuredCategories = [...DEFAULT_PREMIUM_LEVELS];
        }
        renderCategoryChips();
        renderCategoryCards();
      }, err => {
        console.warn("Could not load premiumCategories:", err);
        configuredCategories = [...DEFAULT_PREMIUM_LEVELS];
        renderCategoryChips();
        renderCategoryCards();
      });
  }

  function renderCategoryChips() {
    if (!categoryChipsWrap) return;

    // Gather all distinct categories (configured list + any present on loaded quizzes)
    const allCategoriesSet = new Set(configuredCategories);
    allLoadedCategories.forEach(cat => {
      const lvl = getQuizCategoryLevel(cat);
      if (lvl) allCategoriesSet.add(lvl);
    });

    const categoryList = Array.from(allCategoriesSet);

    // If active category was removed, fallback to "all"
    if (activeCategoryFilter !== "all" && !allCategoriesSet.has(activeCategoryFilter)) {
      activeCategoryFilter = "all";
    }

    categoryChipsWrap.innerHTML = "";

    // 1. "All Quizzes" Chip
    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = `premium-cat-chip ${activeCategoryFilter === "all" ? "active" : ""}`;
    allBtn.innerHTML = `All Quizzes <span style="opacity:0.8; font-size:0.78rem;">(${allLoadedCategories.length})</span>`;
    allBtn.addEventListener("click", () => {
      activeCategoryFilter = "all";
      renderCategoryChips();
      renderCategoryCards();
    });
    categoryChipsWrap.appendChild(allBtn);

    // 2. Individual Category Chips
    categoryList.forEach(catName => {
      const count = allLoadedCategories.filter(c => getQuizCategoryLevel(c) === catName).length;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `premium-cat-chip ${activeCategoryFilter === catName ? "active" : ""}`;
      btn.innerHTML = `${escapeHtml(catName)} <span style="opacity:0.8; font-size:0.78rem;">(${count})</span>`;
      btn.addEventListener("click", () => {
        activeCategoryFilter = catName;
        renderCategoryChips();
        renderCategoryCards();
      });
      categoryChipsWrap.appendChild(btn);
    });
  }

  function renderCategoryCards() {
    if (!categoriesGrid) return;

    if (allLoadedCategories.length === 0) {
      categoriesGrid.innerHTML = `
        <div class="premium-empty-card">
          <h3>No Quizzes Published Yet</h3>
          <p>
            The administrator has not added any premium quizzes yet. Please check back shortly or explore the Live Quiz and MCQ Hub!
          </p>
        </div>
      `;
      return;
    }

    const filtered = activeCategoryFilter === "all"
      ? allLoadedCategories
      : allLoadedCategories.filter(c => getQuizCategoryLevel(c) === activeCategoryFilter);

    if (filtered.length === 0) {
      categoriesGrid.innerHTML = `
        <div class="premium-empty-card">
          <h3>No Quizzes in "${escapeHtml(activeCategoryFilter)}"</h3>
          <p>
            There are currently no quizzes published under this category. Choose another level or view all available quizzes.
          </p>
          <button type="button" class="btn btn-outline btn-sm" id="viewAllQuizzesBtn" style="font-weight:600;">
            View All Quizzes (${allLoadedCategories.length})
          </button>
        </div>
      `;
      const viewAllBtn = document.getElementById("viewAllQuizzesBtn");
      if (viewAllBtn) {
        viewAllBtn.addEventListener("click", () => {
          activeCategoryFilter = "all";
          renderCategoryChips();
          renderCategoryCards();
        });
      }
      return;
    }

    categoriesGrid.innerHTML = "";
    filtered.forEach(cat => {
      const card = document.createElement("div");
      card.className = "category-card";
      card.id = `quiz-card-${cat.id}`;
      card.setAttribute("data-quiz-id", cat.id);

      const bgImg = cat.imageUrl
        ? `background-image:url('${escapeHtml(cat.imageUrl)}');`
        : "background: linear-gradient(135deg, #1e293b 0%, #3b82f6 100%);";
      
      const qCount = Array.isArray(cat.questions) ? cat.questions.length : (cat.questionCount || 0);
      const cost = Math.max(1, Number(cat.credits || 3));
      const countBadge = qCount > 0 ? `${qCount} Qs · ${cost} Credits` : `${cost} Credits`;
      const catLevel = getQuizCategoryLevel(cat);

      card.innerHTML = `
        <div class="category-card-img" style="${bgImg}">
          <span class="category-card-share-badge" title="Share this quiz to social media" aria-label="Share ${escapeHtml(cat.name || 'quiz')}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
            <span>Share</span>
          </span>
          <span class="category-card-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:4px;"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M15 9.5a3.5 3.5 0 0 0-7 0c0 2 1.5 3 3.5 3.5s3.5 1.5 3.5 3.5a3.5 3.5 0 0 1-7 0"/></svg>${escapeHtml(countBadge)}
          </span>
        </div>
        <div class="category-card-body">
          <span class="premium-card-level-badge">${escapeHtml(catLevel)}</span>
          <h3>${escapeHtml(cat.name || "Premium Quiz")}</h3>
          <p>
            ${escapeHtml(cat.description || "Comprehensive timed competitive examination practice questions.")}
          </p>
          <div class="category-card-actions">
            <button type="button" class="btn btn-primary btn-sm start-cat-btn" style="flex:1; font-weight:700; padding:12px 14px; display:flex; align-items:center; justify-content:center; gap:8px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <span>Play Quiz (${cost} Credit${cost === 1 ? "" : "s"})</span>
            </button>
            <button type="button" class="category-card-share-action-btn" title="Share to WhatsApp, Facebook, X, etc." aria-label="Share ${escapeHtml(cat.name || 'quiz')}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
              <span>Share</span>
            </button>
          </div>
        </div>
      `;

      const shareBadge = card.querySelector(".category-card-share-badge");
      if (shareBadge) {
        shareBadge.addEventListener("click", (e) => {
          e.stopPropagation();
          openQuizShareModal(cat);
        });
      }

      const shareBtn = card.querySelector(".category-card-share-action-btn");
      if (shareBtn) {
        shareBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openQuizShareModal(cat);
        });
      }

      card.querySelector(".start-cat-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        handleQuizCardClick(cat);
      });
      card.addEventListener("click", () => {
        handleQuizCardClick(cat);
      });

      categoriesGrid.appendChild(card);
    });
  }

  async function loadCategories() {
    if (!categoriesGrid) return;
    categoriesGrid.innerHTML = '<p class="quiz-muted">Loading available premium quizzes…</p>';

    try {
      const snap = await db.collection("premiumQuizContent").get();
      allLoadedCategories = [];
      if (!snap.empty) {
        snap.forEach(d => {
          allLoadedCategories.push(Object.assign({ id: d.id }, d.data()));
        });
        allLoadedCategories.sort((a, b) => {
          const od = (a.displayOrder ?? 99) - (b.displayOrder ?? 99);
          return od !== 0 ? od : (a.name || "").localeCompare(b.name || "");
        });
      }

      renderCategoryChips();
      renderCategoryCards();

      // Check if URL contains deep link for a specific shared quiz
      checkAndHandleDeepLinkQuiz();
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
     Deep Link Auto-Detection & Direct Play Launcher
     ============================================================ */
  let deepLinkHandled = false;

  async function checkAndHandleDeepLinkQuiz() {
    if (deepLinkHandled) return;

    const urlParams = new URLSearchParams(window.location.search);
    const targetQuizId = urlParams.get("quiz") || urlParams.get("id") || sessionStorage.getItem("pendingAutoStartQuizId");
    if (!targetQuizId) return;

    if (!allLoadedCategories || allLoadedCategories.length === 0) return;

    const targetCat = allLoadedCategories.find(c =>
      c.id === targetQuizId ||
      (c.slug && c.slug.toLowerCase() === targetQuizId.toLowerCase()) ||
      (c.name && c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") === targetQuizId.toLowerCase())
    );

    if (!targetCat) return;

    // If user is currently signed in
    if (currentUser) {
      deepLinkHandled = true;
      sessionStorage.removeItem("pendingAutoStartQuizId");

      // Check unlimited access
      const hasUnlimited = await checkUserHasAccess(currentUser);
      if (hasUnlimited) {
        startCategoryQuiz(targetCat, "Unlimited");
        return;
      }

      // Check credits
      const cost = Math.max(1, Number(targetCat.credits || 3));
      const userCredits = Number(currentUserProfile?.credits ?? 0);

      // Launch quiz confirmation or buy packages
      handleQuizCardClick(targetCat, true);
      return;
    }

    // User is NOT logged in yet (opened from social media link)
    deepLinkHandled = true;

    // Scroll smoothly to target quiz card so user sees what they clicked
    setTimeout(() => {
      const cardEl = document.getElementById("quiz-card-" + targetCat.id);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
        cardEl.style.transition = "box-shadow 0.3s ease";
        cardEl.style.boxShadow = "0 0 0 4px rgba(232, 131, 78, 0.6)";
        setTimeout(() => { cardEl.style.boxShadow = ""; }, 3200);
      }
    }, 300);

    // Prompt user to sign in or create account to play immediately
    openPromptModal({
      iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>',
      iconBg: '#eff6ff',
      iconColor: '#2563eb',
      title: `Play "${targetCat.name || 'Premium Quiz'}"`,
      desc: `You've opened <strong>${escapeHtml(targetCat.name || 'this quiz')}</strong>! Sign in or create a free account to play now.<br><br><span style="display:inline-block; margin-top:4px; color:#059669; font-weight:700;">✨ New accounts receive 2 FREE credits automatically!</span>`,
      actionText: "Sign In / Sign Up to Play",
      onAction: () => {
        sessionStorage.setItem("pendingAutoStartQuizId", targetCat.id);
        deepLinkHandled = false; // Reset so onAuthStateChanged can trigger after login
        if (typeof window.openAuthModal === "function") {
          window.openAuthModal({
            mode: "signup",
            title: "Create Free Account",
            subtitle: `Sign up to unlock "${targetCat.name}" with 2 free credits!`
          });
        }
      }
    });
  }

  // Subscribe to category level configuration changes in real time
  subscribeConfiguredCategories();

  /* ============================================================
     Quiz Card Click Handler (Gate: Sign Up -> Credit Check/Deduction -> Pay/Play)
     ============================================================ */
  async function handleQuizCardClick(category, isAutoStart = false) {
    if (!category) return;

    // 1. If user is NOT signed in: ask them to first signup/signin
    if (!currentUser) {
      openPromptModal({
        iconSvg: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
        iconBg: '#eff6ff',
        iconColor: '#2563eb',
        title: isAutoStart ? `Play "${category.name || 'Premium Quiz'}"` : "Account Required",
        desc: isAutoStart
          ? `You opened <strong>${escapeHtml(category.name || 'this quiz')}</strong>! Sign in or create a free account to start playing.<br><br><span style="display:inline-block; margin-top:4px; color:#059669; font-weight:700;">✨ New accounts receive 2 FREE credits automatically!</span>`
          : `To play or try "${escapeHtml(category.name || 'this quiz')}", please create a free account or sign in first.<br><br><span style="display:inline-block; margin-top:4px; color:#059669; font-weight:700;">✨ New accounts receive 2 FREE credits!</span>`,
        actionText: "Sign Up / Sign In",
        onAction: () => {
          sessionStorage.setItem("pendingAutoStartQuizId", category.id);
          deepLinkHandled = false;
          if (typeof window.openAuthModal === "function") {
            window.openAuthModal({
              mode: "signup",
              title: "Create Free Account",
              subtitle: `Sign up to unlock "${category.name}" with 2 free credits!`
            });
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
    
    // Track whether this quiz session is for an unlimited-access user
    currentUnlimitedAccess = remainingCredits === "Unlimited";

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
    const progressBar = document.getElementById("premiumProgressBar");
    if (progressBar && activeQuestions.length > 0) {
      const pct = Math.round(((currentQIdx + 1) / activeQuestions.length) * 100);
      progressBar.style.width = `${pct}%`;
    }
    if (questionText) questionText.textContent = q.question || "";
    if (optionsGrid) optionsGrid.innerHTML = "";

    const opts = q.options || [];
    let answered = false;

    // Shuffle options with Fisher-Yates, tracking where the correct answer lands
    const shuffled = opts.map((text, i) => ({ text, originalIdx: i }));
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const shuffledCorrectIdx = shuffled.findIndex(o => o.originalIdx === Number(q.correctIndex || 0));

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

    shuffled.forEach(({ text: optText }, idx) => {
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

        const isCorrect = idx === shuffledCorrectIdx;

        // Disable all buttons and highlight correct / wrong
        optionsGrid.querySelectorAll(".mcq-opt").forEach((b, i) => {
          b.disabled = true;
          b.style.cursor = "default";
          if (i === shuffledCorrectIdx) {
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
          showFeedback(`Incorrect. Correct answer: Option ${String.fromCharCode(65 + shuffledCorrectIdx)}.`, false, q.explanation);
        }

        if (nextQuestionBtn) nextQuestionBtn.style.display = "inline-flex";
      });

      optionsGrid.appendChild(btn);
    });

    function handleTimeout() {
      if (answered) return;
      answered = true;
      playBeep(220, "sawtooth", 0.28);

      optionsGrid.querySelectorAll(".mcq-opt").forEach((b, i) => {
        b.disabled = true;
        b.style.cursor = "default";
        if (i === shuffledCorrectIdx) {
          b.classList.add("is-correct");
          b.style.borderColor = "#10b981";
          b.style.background = "#ecfdf5";
        }
      });

      showFeedback(`Time's up! Correct answer: Option ${String.fromCharCode(65 + shuffledCorrectIdx)}.`, false, q.explanation);
      if (nextQuestionBtn) nextQuestionBtn.style.display = "inline-flex";
    }
  }

  function updateTimerDisplay() {
    if (!timerBadge) return;
    timerBadge.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:4px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${secondsLeft}s`;
    if (secondsLeft <= 5) {
      timerBadge.style.background = "#fee2e2";
      timerBadge.style.color = "#dc2626";
      timerBadge.classList.add("timer-alert");
    } else {
      timerBadge.style.background = "#eff6ff";
      timerBadge.style.color = "#1d4ed8";
      timerBadge.classList.remove("timer-alert");
    }
  }

  function showFeedback(msg, isCorrect, explanation) {
    if (!feedbackBar) return;
    const iconSvg = isCorrect
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;color:#10b981;margin-top:2px;"><polyline points="20 6 9 17 4 12"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;color:#d97706;margin-top:2px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    feedbackBar.innerHTML = `
      <div style="display:flex; align-items:flex-start; gap:10px;">
        ${iconSvg}
        <div style="flex:1;">
          <strong style="font-size:0.95rem; display:block;">${escapeHtml(msg)}</strong>
          ${explanation ? `<div style="font-size:0.86rem; margin-top:5px; opacity:0.92; line-height:1.45;">${escapeHtml(explanation)}</div>` : ""}
        </div>
      </div>
    `;
    feedbackBar.className = `status-alert ${isCorrect ? "success" : "warning"} arena-feedback-bar`;
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
      // If user has unlimited access (hasUnlimitedAccess flag set during quiz start),
      // show "Unlimited" instead of the raw credit balance
      if (currentUnlimitedAccess) {
        resultsRemainingCredits.textContent = "Unlimited";
      } else {
        const bal = currentUserProfile && currentUserProfile.credits != null
          ? currentUserProfile.credits
          : 0;
        resultsRemainingCredits.textContent = `${bal}`;
      }
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

  /* ---------- Bank QR Lightbox ---------- */
  (function () {
    const lightbox    = document.getElementById("qrLightbox");
    const closeBtn    = document.getElementById("qrLightboxClose");
    const thumbBtn    = document.getElementById("bankQrThumbBtn");
    if (!lightbox || !thumbBtn) return;

    function openQrLightbox() {
      lightbox.style.display = "flex";
      document.body.style.overflow = "hidden";
      closeBtn && closeBtn.focus();
    }
    function closeQrLightbox() {
      lightbox.style.display = "none";
      document.body.style.overflow = "";
      thumbBtn.focus();
    }

    thumbBtn.addEventListener("click", openQrLightbox);
    if (closeBtn) closeBtn.addEventListener("click", closeQrLightbox);

    // Click backdrop to close
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) closeQrLightbox();
    });

    // Escape key to close
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (lightbox.style.display === "flex") closeQrLightbox();
        if (quizShareModal && quizShareModal.style.display === "flex") closeQuizShareModal();
      }
    });
  })();
});

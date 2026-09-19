/* ============================================
   nav-drawer.js — mobile off-canvas nav drawer +
   mobile search-icon toggle. Shared across all pages
   that include the standard site header.
   ============================================ */

(function () {
  const navToggle = document.getElementById("navToggle");
  const navDrawer = document.getElementById("navDrawer");
  const drawerOverlay = document.getElementById("drawerOverlay");
  const drawerClose = document.getElementById("drawerClose");

  if (navToggle && navDrawer && drawerOverlay) {
    function openDrawer() {
      navDrawer.classList.add("open");
      drawerOverlay.classList.add("visible");
    }
    function closeDrawer() {
      navDrawer.classList.remove("open");
      drawerOverlay.classList.remove("visible");
    }

    navToggle.addEventListener("click", openDrawer);
    if (drawerClose) drawerClose.addEventListener("click", closeDrawer);
    drawerOverlay.addEventListener("click", closeDrawer);
    navDrawer.querySelectorAll(".drawer-nav a").forEach((a) => {
      a.addEventListener("click", closeDrawer);
    });
  }

  // Dropdown toggle inside the drawer and desktop nav — tap-to-toggle
  document.querySelectorAll(".dropdown-toggle").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const dropdown = btn.closest(".dropdown");
      const wasOpen = dropdown.classList.contains("open");
      document.querySelectorAll(".dropdown.open").forEach((d) => d.classList.remove("open"));
      if (!wasOpen) {
        dropdown.classList.add("open");
      }
    });
  });

  // Close open dropdowns when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".dropdown")) {
      document.querySelectorAll(".dropdown.open").forEach((d) => d.classList.remove("open"));
    }
  });

  // Mobile search icon — reveals a search bar under the header (only on
  // pages that have one, e.g. index.html). No search bar lives in the
  // nav drawer itself, by design.
  const searchToggle = document.getElementById("searchToggle");
  const mobileSearch = document.getElementById("mobileSearch");
  const mobileSearchInput = document.getElementById("mobileSearchInput");
  const desktopSearchInput = document.getElementById("searchInput");

  if (searchToggle && mobileSearch) {
    searchToggle.addEventListener("click", () => {
      mobileSearch.hidden = !mobileSearch.hidden;
      if (!mobileSearch.hidden && mobileSearchInput) mobileSearchInput.focus();
    });
  }

  // Keep the mobile search box in sync with the same filtering behavior
  // as the desktop search box (both filter the same hub cards on index.html).
  if (mobileSearchInput && desktopSearchInput) {
    mobileSearchInput.addEventListener("input", () => {
      desktopSearchInput.value = mobileSearchInput.value;
      desktopSearchInput.dispatchEvent(new Event("input"));
    });
  }
})();

/* ---------- Light / Dark Theme Controller ---------- */
(function initTheme() {
  const MOON_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  const SUN_SVG  = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

  function getSavedTheme() {
    try { return localStorage.getItem("theme"); } catch (e) { return null; }
  }

  function getSystemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const isDark = theme === "dark";
    const title = isDark ? "Switch to light theme" : "Switch to dark theme";

    // Header toggles (desktop .header-actions and mobile .mobile-header-icons)
    document.querySelectorAll(".header-actions .theme-toggle-btn, .mobile-header-icons .theme-toggle-btn").forEach((btn) => {
      btn.innerHTML = isDark ? SUN_SVG : MOON_SVG;
      btn.title = title;
      btn.setAttribute("aria-label", title);
      btn.setAttribute("aria-pressed", String(isDark));
    });

    // Mobile drawer nav toggle
    document.querySelectorAll(".drawer-nav .theme-toggle-btn").forEach((btn) => {
      btn.innerHTML = `${isDark ? SUN_SVG : MOON_SVG} <span>${isDark ? "Light Theme" : "Dark Theme"}</span>`;
      btn.title = title;
      btn.setAttribute("aria-label", title);
      btn.setAttribute("aria-pressed", String(isDark));
    });
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    try { localStorage.setItem("theme", next); } catch (e) {}
    applyTheme(next);
  }

  function makeToggleBtn() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-toggle-btn";
    btn.addEventListener("click", toggleTheme);
    return btn;
  }

  function setupToggles() {
    // Desktop: wire up existing .theme-toggle-btn or inject if missing
    document.querySelectorAll(".header-actions").forEach((actions) => {
      let btn = actions.querySelector(".theme-toggle-btn");
      if (!btn) {
        btn = makeToggleBtn();
        actions.insertBefore(btn, actions.firstChild);
      } else if (!btn.dataset.wired) {
        btn.dataset.wired = "true";
        btn.addEventListener("click", toggleTheme);
      }
    });

    // Mobile header icons: wire up in .mobile-header-icons
    document.querySelectorAll(".mobile-header-icons").forEach((icons) => {
      let btn = icons.querySelector(".theme-toggle-btn");
      if (!btn) {
        btn = makeToggleBtn();
        icons.insertBefore(btn, icons.firstChild);
      } else if (!btn.dataset.wired) {
        btn.dataset.wired = "true";
        btn.addEventListener("click", toggleTheme);
      }
    });

    // Mobile: wire up in .drawer-nav
    document.querySelectorAll(".drawer-nav").forEach((nav) => {
      let btn = nav.querySelector(".theme-toggle-btn");
      if (!btn) {
        btn = makeToggleBtn();
        nav.appendChild(btn);
      } else if (!btn.dataset.wired) {
        btn.dataset.wired = "true";
        btn.addEventListener("click", toggleTheme);
      }
    });

    // Remove any stale toggles from .main-nav
    document.querySelectorAll(".main-nav .theme-toggle-btn").forEach((btn) => {
      btn.remove();
    });

    // Re-apply so all buttons get the right icon
    applyTheme(document.documentElement.getAttribute("data-theme") || "light");
  }

  // Apply theme immediately (before paint) to avoid flash
  const saved = getSavedTheme();
  applyTheme(saved || getSystemTheme());

  // Setup buttons after DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupToggles);
  } else {
    setupToggles();
  }

  // Instant page transition prefetcher: prefetch on hover for 0ms transitions
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPrefetcher);
  } else {
    initPrefetcher();
  }

  function initPrefetcher() {
    document.querySelectorAll(".main-nav a, .drawer-nav a").forEach((link) => {
      link.addEventListener("mouseenter", () => {
        const href = link.getAttribute("href");
        if (href && !href.startsWith("#") && !href.startsWith("http") && !document.querySelector(`link[rel="prefetch"][href="${href}"]`)) {
          const prefetch = document.createElement("link");
          prefetch.rel = "prefetch";
          prefetch.href = href;
          document.head.appendChild(prefetch);
        }
      }, { once: true });
    });
  }

  // Page transition: fade-out before navigating (fallback for non-View-Transitions browsers)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPageTransitions);
  } else {
    initPageTransitions();
  }

  function initPageTransitions() {
    // Skip if View Transitions API is natively supported — CSS handles it
    if (document.startViewTransition) return;

    document.addEventListener("click", (e) => {
      const link = e.target.closest("a[href]");
      if (!link) return;
      const href = link.getAttribute("href");
      // Only intercept same-origin, non-hash, non-external links
      if (!href || href.startsWith("#") || href.startsWith("javascript") ||
          href.startsWith("http") || href.startsWith("mailto") ||
          link.target === "_blank") return;

      e.preventDefault();
      document.body.classList.add("page-leaving");
      // Wait for CSS transition (150ms) then navigate
      setTimeout(() => { window.location.href = href; }, 150);
    });
  }

  // Also respond to OS theme changes (if user hasn't manually toggled)
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (!getSavedTheme()) {
      applyTheme(e.matches ? "dark" : "light");
    }
  });
})();


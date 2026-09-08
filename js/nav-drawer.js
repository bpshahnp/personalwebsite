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
    navDrawer.querySelectorAll(".drawer-nav > a").forEach((a) => {
      a.addEventListener("click", closeDrawer);
    });
  }

  // "See More Options" dropdown inside the drawer (and anywhere else on
  // the page) — tap-to-toggle, since CSS :hover doesn't work on touch.
  document.querySelectorAll(".dropdown-toggle").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      btn.closest(".dropdown").classList.toggle("open");
    });
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

    // Desktop toggle sits in .header-actions
    document.querySelectorAll(".header-actions .theme-toggle-btn").forEach((btn) => {
      btn.innerHTML = isDark ? SUN_SVG : MOON_SVG;
      btn.title = title;
      btn.setAttribute("aria-label", title);
      btn.setAttribute("aria-pressed", String(isDark));
    });

    // Mobile toggle sits in .drawer-nav
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
    // Desktop: inject into .header-actions (before the auth-widget), NOT .main-nav
    document.querySelectorAll(".header-actions").forEach((actions) => {
      if (!actions.querySelector(".theme-toggle-btn")) {
        const btn = makeToggleBtn();
        // Prepend so it appears before the auth widget
        actions.insertBefore(btn, actions.firstChild);
      }
    });

    // Mobile: inject at the end of the mobile drawer nav bar (.drawer-nav)
    document.querySelectorAll(".drawer-nav").forEach((nav) => {
      if (!nav.querySelector(".theme-toggle-btn")) {
        const btn = makeToggleBtn();
        nav.appendChild(btn);
      }
    });

    // Remove any stale toggles from .main-nav or .mobile-header-icons
    document.querySelectorAll(".main-nav .theme-toggle-btn, .mobile-header-icons .theme-toggle-btn").forEach((btn) => {
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

  // Also respond to OS theme changes (if user hasn't manually toggled)
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (!getSavedTheme()) {
      applyTheme(e.matches ? "dark" : "light");
    }
  });
})();


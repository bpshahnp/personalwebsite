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

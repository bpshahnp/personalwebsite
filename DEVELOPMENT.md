# Development & Maintenance Guide

> **Developer Guidelines for B. Prasad Shah Educational Platform**

---

## 1. Local Development Setup

Because the site makes Firebase API requests and imports ES modules/workers, run the codebase through a local HTTP server instead of opening files directly with `file://`.

### Running Locally
```powershell
# From the project root
python -m http.server 8000
```
Then visit: `http://localhost:8000` in your web browser.

---

## 2. Coding Guidelines & Invariants

### 2.1. Adding / Modifying CSS
- All core styles reside in **`css/style.css`**. Tournament-specific styling belongs in **`css/live.css`**.
- **Dark Mode Requirement**:
  - Whenever adding a new visual component or card, you MUST define both light and dark mode styles.
  - Never assume `--white` means white text! In dark mode, `--white` is mapped to `#1e293b` (card background).
  - Use explicit `#ffffff` or `#f8fafc` for text meant to stay white on dark backgrounds.
  - Test new components with both `[data-theme="light"]` and `[data-theme="dark"]`.
- **Mobile First & No Horizontal Overflow**:
  - Test with mobile viewport width set to 360px and 390px.
  - Verify that `document.documentElement.scrollWidth === document.documentElement.clientWidth`.
  - Any fixed-width drawer or rail must have `visibility: hidden; pointer-events: none;` when inactive.

### 2.2. Modifying Questions & Curriculum
- When adding questions manually in `admin.html` or programmatically:
  - Supported classes: `"8"`, `"9"`, `"10"`.
  - Always provide `classLevel`, `category`, `question`, `options` (array of 4 strings), `correctIndex` (0–3), and `explanation`.
  - Untagged legacy questions automatically resolve to Class 10.

### 2.3. Cache Busting Checklist
Whenever you update `css/style.css` or core scripts:
1. Increment the version tag across all HTML files:
   - Example: `css/style.css?v=20260920_03` -> `css/style.css?v=20260920_04`.
2. A helper Python script can be used to bump all HTML files in one go:
   ```python
   import glob, re
   for path in glob.glob("*.html"):
       with open(path, "r", encoding="utf-8") as f:
           content = f.read()
       new_content = re.sub(r'css/style\.css(?:\?v=[a-zA-Z0-9_-]+)?', 'css/style.css?v=YYYYMMDD_XX', content)
       with open(path, "w", encoding="utf-8") as f:
           f.write(new_content)
   ```

### 2.4. Header & Navigation Integrity
Every standard HTML page MUST maintain the synchronized header structure:
- `.site-header` containing `.logo`, `.main-nav`, `.header-actions` (`#themeToggleBtn` + `#authWidget`).
- `.mobile-header-icons` containing `#navToggle` + mobile `#authWidget`.
- `.nav-drawer` (#navDrawer) + `.drawer-overlay` (#drawerOverlay).
- Scripts in order before `</body>`:
  1. Firebase App, Auth, Firestore compat SDKs.
  2. `js/firebase-config.js`
  3. `js/auth-widget.js`
  4. `js/nav-drawer.js`
  5. Page-specific controller script (e.g. `js/mcq.js`, `js/python-hub.js`, etc.)

---

## 3. Deployment Checklist

1. **Verify Security Rules**:
   - Ensure any new Firestore collection is explicitly guarded in `firestore.rules`.
   - Ensure `ADMIN_EMAILS` in `js/firebase-config.js` matches `isAdmin()` in `firestore.rules`.
2. **Deploy to Firebase**:
   ```bash
   firebase deploy --only hosting,firestore:rules
   ```
3. **Post-Deployment Verification**:
   - Open in an incognito window.
   - Toggle theme button (Sun / Moon) to verify dark mode consistency.
   - Inspect mobile menu drawer opening and closing smoothly.
   - Complete one MCQ test and verify score writes to leaderboard.

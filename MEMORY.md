# Project Memory & Architecture Context

> **Last Updated:** September 20, 2026  
> **Author & Maintainer:** B. Prasad Shah  
> **Primary Audience:** AI assistants, developers, and project maintainers

---

## 1. Project Overview & Vision

**B. Prasad Shah Educational Platform** is a curriculum-aligned interactive web application built primarily for school students in Nepal (Classes 8, 9, and 10), as well as competitive exam aspirants (Loksewa, banking, general knowledge) and programming learners.

### Core Pillars
1. **MCQ Hub (`mcq.html` / `js/mcq.js`)**: Interactive practice quiz with instant feedback, time tracking, class-filtered question banks, topic mastery tracking, and results review.
2. **Python Hub (`python.html` / `js/python-hub.js`)**: Searchable, categorized repository of runnable Python programs powered by client-side WebAssembly via **Pyodide** (no backend server required).
3. **Live Weekly Challenge (`live-quiz.html` / `live.html` / `js/live-quiz.js`)**: 7-day timed tournament with 10 rotating daily questions, speed bonuses, live countdowns, and weekly winner podiums.
4. **Premium Quiz Portal (`premium.html` / `js/premium.js`)**: Specialized question banks for competitive exams (Loksewa, Banking, Geography), gated by weekly tournament performance, manual payment verification (eSewa / Khalti), or credit packs. Includes responsive **Category / Level filter chips** (Beginners Level, Intermediate Level, Higher Level, Loksewa, + custom) dynamically managed from the Admin Panel.
5. **Leaderboard (`leaderboard.html` / `js/leaderboard.js`)**: Real-time ranking with filters for Class 8, 9, 10, All Classes, and timeframe filters (Today, This Week, This Month, All Time).
6. **Additional Resources (`resources.html` / `js/resources.js`)**: Class study notes, PDFs, and slide decks linked to Google Drive.
7. **Video Hub (`video.html`)**: Filterable curated tutorial videos with responsive modals.
8. **Admin Panel (`admin.html` / `js/admin.js`)**: Comprehensive CMS interface with Google/Email sign-in, allowlist gating, and CRUD capabilities for questions, programs, updates, live quizzes, and user management.

---

## 2. Tech Stack & Architectural Philosophy

- **Zero-Build Architecture**: Plain HTML5, CSS3, and ES6+ JavaScript. No Node.js build steps, Webpack, Vite, or npm compilation required for deployment. Any change is directly testable in the browser.
- **Backend & Persistence**: Google Firebase (Firestore Database, Firebase Authentication, Firebase Hosting).
- **Execution Engine**: Pyodide (Python compiled to WASM) for running Python code safely in the browser.
- **Design System**: Custom CSS variables, responsive mobile-first grids, Fraunces serif display typography, Inter body/UI typography.
- **Dual Themes**: Complete light and dark modes controlled via `data-theme` on the `<html>` root element.

---

## 3. Directory Map & Component Roles

```
personalwebsite-main/
├── index.html                   # Home landing page with stats, hubs, how-it-works, updates
├── mcq.html                     # MCQ Hub quiz application
├── python.html                  # Python Hub runnable IDE & program library
├── live-quiz.html (live.html)   # 7-Day Live Quiz Tournament interface
├── premium.html                 # Premium Quiz catalog, credits, and payment verification
├── leaderboard.html             # Multi-class, multi-timeframe leaderboard
├── video.html                   # Video tutorials hub
├── resources.html               # Reference materials & downloadable notes
├── contact.html                 # Contact form & instructor bio
├── admin.html                   # Admin CMS & moderation dashboard
├── privacy.html                 # Privacy policy & student data disclosure
├── typingcompetition2083.html   # Typing competition event page
│
├── css/
│   ├── style.css                # Master stylesheet: typography, grid, buttons, dark mode, nav
│   └── live.css                 # Live quiz and tournament animations & specialized widgets
│
├── js/
│   ├── firebase-config.js       # Firebase credentials & ADMIN_EMAILS allowlist
│   ├── auth-widget.js           # Shared profile dropdown & authentication modal
│   ├── nav-drawer.js            # Responsive off-canvas navigation & theme toggling
│   ├── script.js                # Index page logic: updates feed, search filtering
│   ├── mcq.js                   # MCQ engine, question bank loading, progress calculation
│   ├── python-hub.js            # Python Hub programs loader, category rail, editor & runner
│   ├── live-quiz.js             # Live weekly challenge logic, timer, scoring, sound fx
│   ├── premium.js               # Premium quiz gatekeeper, payment submissions, catalog
│   ├── leaderboard.js           # Score aggregator, rank medals, class filters
│   ├── resources.js             # Drive resources listener and categorizer
│   ├── contact.js               # Firestore contact message dispatch
│   ├── admin.js                 # Admin authentication gate & CRUD panel operations
│   ├── pyodide-worker.js        # Background worker for Python execution
│   └── coi-serviceworker.js     # Cross-origin isolation helper
│
├── assets/                      # Logos, profile photos, favicons
├── firestore.rules              # Database security rules (client read/write restrictions)
├── firestore.indexes.json       # Composite index definitions
└── README.md                    # Project readme and Firebase setup instructions
```

---

## 4. Key Conventions & Engineering Rules

### 4.1. Theme Architecture (Light / Dark)
- Root selector: `html[data-theme="dark"]` or `[data-theme="dark"]`.
- System automatically checks `localStorage.getItem("theme")` on boot, falling back to `window.matchMedia("(prefers-color-scheme: dark)")`.
- **CRITICAL**: `--white` is repurposed in dark mode to `#1e293b` (card surface). Therefore:
  - Do NOT use `color: var(--white)` for text meant to stay bright white on dark gradients/headers. Use explicit `#ffffff` or `#f8fafc`.
  - All `.page-hero h1` elements must have explicit `#ffffff` color.
  - Form inputs (`input`, `select`, `textarea`) in dark mode use `#0f172a` background, `#334155` border, and `#f8fafc` text.

### 4.2. Mobile Layout & Overflow Rules
- Both `html` and `body` have `overflow-x: hidden; max-width: 100%;`.
- All off-canvas drawers (`.nav-drawer`, `.mcqhub-rail`, `.pyhub-rail`):
  - Must include `visibility: hidden; pointer-events: none;` when closed to prevent off-screen geometry from blowing out mobile viewport widths (320px–480px).
  - Transition into view using `visibility: visible; pointer-events: auto; transform: translateX(0);` when active.

### 4.3. Cache Busting Convention
- Because GitHub Pages or Firebase Hosting caches static CSS/JS aggressively:
  - All HTML files must link `css/style.css` using the standard query string: `css/style.css?v=YYYYMMDD_XX` (e.g., `?v=20260920_03`).
  - Whenever updating `style.css` or shared JS, bump the version string across all HTML files.

### 4.4. MCQ Class Partitioning
- Classes supported: `"8"`, `"9"`, and `"10"`.
- Legacy / untagged questions in Firestore default to Class 10 automatically without requiring database migration.
- When adding new classes, update `CLASS_LEVELS` array in both `js/mcq.js` and `js/admin.js`.

---

## 5. Firebase Security & Allowlist
- The admin check in `js/firebase-config.js` (`ADMIN_EMAILS`) MUST match the `isAdmin()` function in `firestore.rules`:
  ```javascript
  const ADMIN_EMAILS = ["bholashroff345@gmail.com"];
  ```
- Public read access is granted for educational materials (`questions`, `pythonPrograms`, `resources`, `updates`, `scores`, `siteSettings`, `premiumQuizContent`).
- Restricted access applies to user scores (`scores/{uid}`: user-only write), manual payments (`premiumRequests`), and direct messages (`messages`).

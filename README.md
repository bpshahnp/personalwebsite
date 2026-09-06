# B. Prasad Shah — Website

Plain HTML/CSS/JS site with a live Firebase database, so your "Latest
Updates" section stays in sync across every device automatically.

## File structure

```
bprasadshah/
├── index.html            → home page
├── mcq.html              → MCQ Hub — full quiz with live scoring, from Firestore, filtered by class
├── python.html           → Python Hub — searchable, runnable Python programs
├── leaderboard.html      → Leaderboard — top MCQ quiz scores, ranked live, per class
├── admin.html            → Admin Panel — add/edit/delete questions, programs & updates
├── firestore.rules        → security rules (see step 5)
├── firestore.indexes.json → Firestore index config (no composite index needed — see Leaderboard)
├── css/style.css          → all styling
├── js/firebase-config.js  → connects to YOUR Firebase project + admin allowlist
├── js/auth-widget.js      → shared account icon + login/logout dropdown (all pages)
├── js/script.js           → home page: nav, search, live "Latest Updates"
├── js/mcq.js              → quiz engine (start screen, live score, results, saves to leaderboard)
├── js/leaderboard.js      → renders ranked scores on leaderboard.html
├── js/python-hub.js       → renders programs, search/category filter, runs code via Pyodide
├── js/admin.js            → sign-in gate + CRUD forms on admin.html
└── README.md              → this guide
```

## 1. Create your Firebase project

1. Go to https://console.firebase.google.com and click **Add project**.
2. Name it (e.g. `b-prasad-shah`) → create.
3. In the left sidebar: **Build → Firestore Database → Create database**.
   Choose *Start in test mode* for now (you'll lock it down later, see
   step 4).
4. In the left sidebar: **Build → Authentication → Get started** → enable
   the **Email/Password** sign-in method (this powers the Login/Sign Up
   button).
5. Click the gear icon → **Project settings** → scroll to "Your apps" →
   click the `</>` (Web) icon → register an app (no need for Firebase
   Hosting setup here yet, just register).
6. Firebase shows you a `firebaseConfig` object with real values
   (`apiKey`, `authDomain`, etc). Copy them into
   `js/firebase-config.js`, replacing the placeholder strings.

## 2. Set up the Admin Panel

The admin panel (`admin.html`) lets you add, edit, and delete MCQ Hub
questions and Latest Updates from the browser — no need to touch the
Firebase console day-to-day.

1. In `js/firebase-config.js`, replace the placeholder in
   `ADMIN_EMAILS` with the email address you'll log in with, e.g.:
   ```js
   const ADMIN_EMAILS = ["yourname@gmail.com"];
   ```
2. Create that user under **Authentication → Users → Add user** in the
   Firebase console (or open `admin.html` and it will offer a normal
   sign-in — you still need the user to exist first).
3. Open `admin.html`, sign in, and you'll see three tabs: **Questions
   (MCQ Hub)**, **Programs (Python Hub)**, and **Latest Updates** —
   each with a form to add new entries and a list below it with
   Edit/Delete buttons on every entry.

⚠️ `ADMIN_EMAILS` only controls what the *page* shows. Anyone could
still write to Firestore directly unless you also lock it down with
security rules — see step 5 below.

## How MCQ Hub works

`mcq.html` is a real quiz, not a static list:
- Visitor picks a **class** (8, 9 or 10), a category, and a number of
  questions, then **Start Quiz**.
- Each question is scored immediately on click, with the running score
  shown live at the top (`Score: X / Y`) and a progress bar.
- At the end, a results screen shows the final score/percentage and a
  full review of every question with the visitor's answer vs. the
  correct one.

Send me your question set whenever you're ready and I'll load it in —
or add them yourself any time via **Admin → Questions**, one at a time
(question text, 4 options, correct option, explanation, category, class).

### Classes

Every question carries a `classLevel` field of `"8"`, `"9"` or `"10"`.

- **Class comes first, category second.** The Category dropdown rebuilds
  itself from whatever the chosen class actually contains, so you can't
  land on a combination with zero questions. The class dropdown shows a
  live count next to each class.
- **Untagged questions are Class 10.** Anything saved before classes
  existed has no `classLevel`, and every page reads a missing or
  unrecognised value as Class 10. Nothing had to be migrated in Firebase —
  the original question bank simply *is* Class 10. Re-saving an old
  question through the admin form writes the field properly.
- **Adding a class later** (say Class 11) means adding it to `CLASS_LEVELS`
  in both `js/mcq.js` and `js/admin.js`, plus an `<option>` in the class
  selects in `mcq.html`, `admin.html` and `leaderboard.html`.


## How Python Hub works

`python.html` mirrors the `.py hub` layout you uploaded: a category
sidebar, a search box, and a card per program. Two differences from a
static version:
- **Content comes from Firestore** (`pythonPrograms` collection), so
  editing it in Admin updates the page live on every device.
- **Run buttons execute the code in-browser** using Pyodide (a Python
  interpreter compiled to WebAssembly) — no backend server needed, and
  output/errors print right under the code.

Add a program from **Admin → Programs (Python Hub)**: title, category,
an optional description, and the code itself.

## How the account icon works

Every page (`index.html`, `mcq.html`, `python.html`, `leaderboard.html`)
now shows a small circular account icon (👤) in the header instead of
a full "Login / Sign Up" or "Hi, name (Logout)" button — that text
button was wide enough to break the nav bar on smaller screens.
Clicking the icon opens a small dropdown with a login/signup form (if
signed out) or your email + a Logout button (if signed in). It's one
shared file, `js/auth-widget.js`, wired into every page's header.

## How the Leaderboard works

`leaderboard.html` shows the top MCQ quiz scores, best average first,
with medal icons for the top 3 and a class filter across the top.

- Firestore collection: `scores`, **one document per user** (the doc
  ID is their Firebase Auth UID).
- The document's top-level totals (`attempts`, `averagePercentage`,
  `bestPercentage`) cover every attempt the user has made and drive the
  **All classes** board.
- A `classStats` map holds the same figures per class —
  `classStats["9"].averagePercentage` and so on — and drives the **Class
  8 / 9 / 10** boards. A user appears on a class board only once they've
  taken a quiz set to that class.
- A quiz taken with Class = *All classes* is a mixed bag, so it counts
  towards the overall board only and is deliberately left out of every
  per-class average. The results screen says as much.
- If someone isn't logged in, the result screen tells them to log in
  (via the account icon) to save the score — a guest can still take
  the quiz, they just won't appear on the board unless signed in.
- Security rule: anyone can read the leaderboard, but a user can only
  write to their own document (`request.auth.uid == uid`), so no one
  can edit someone else's score.
- **Ranking happens in the browser.** The page pulls the score documents
  once and sorts them client-side, which is why switching class is
  instant and costs no extra reads — and why `firestore.indexes.json`
  needs no composite index at all. If the user base ever outgrows a few
  hundred, move sorting back into Firestore with `orderBy()` and add one
  composite index per class.


## 3. Add your first "Latest Update"

1. In the console, go to **Firestore Database → Start collection**.
2. Collection ID: `updates`.
3. Add a document with these fields:
   - `title` (string) — e.g. `"Practice new Python Notes Hub"`
   - `date` (string) — e.g. `"08/30/2026"`
   - `order` (number) — e.g. `1` (higher number = shows first)
4. Add a few more documents the same way. The website reads this
   collection live — edit it any time, from any device logged into the
   Firebase console, and every visitor's page updates instantly with no
   redeploy needed.

## 4. Run it locally

Because the page uses `fetch`-like Firebase SDK calls, open it through a
local server rather than double-clicking the file:

```bash
cd bprasadshah
python3 -m http.server 8000
# then open http://localhost:8000
```

## 5. Lock down Firestore before going live

Test mode allows anyone to read/write. The exact rules to use live in
**`firestore.rules`** in this project — open it, put your real admin
email(s) in place of the placeholder, then either:

- **Paste manually**: Firebase console → Firestore Database → Rules →
  paste the contents of `firestore.rules` → Publish, or
- **Deploy via CLI** (recommended, keeps rules version-controlled):
  ```bash
  firebase init firestore   # if you haven't already; point it at firestore.rules
  firebase deploy --only firestore:rules
  ```

The rules make `updates` and `questions` publicly readable (so the
site works for visitors) but writable only by the email(s) in the
`isAdmin()` allowlist — which must match `ADMIN_EMAILS` in
`js/firebase-config.js`. Everything else is denied by default, so any
collection you add later starts locked until you explicitly open it up.

## 6. Publish the site (Firebase Hosting)

This gives you one URL that stays updated everywhere — no manual
uploads to different devices.

```bash
npm install -g firebase-tools
firebase login
cd bprasadshah
firebase init hosting
# → choose your existing project
# → public directory: . (current folder)
# → configure as single-page app: No
# → don't overwrite index.html

firebase deploy
```

Firebase will print your live URL (e.g.
`https://b-prasad-shah.web.app`). Any future edits: change files, run
`firebase deploy` again — every device that visits the URL gets the
latest version, and anything stored in Firestore (like Latest Updates)
updates in real time without a redeploy at all.

## Customizing

- **Hero visual**: `.hero-bg` in `css/style.css` is a CSS gradient +
  ring motif (no stock photo, so there's nothing to license). Swap in
  your own photo by adding `background-image: url('assets/your-photo.jpg');`
  to `.hero-bg`.
- **Hub cards / links**: edit the `<article class="hub-card">` blocks in
  `index.html` — point the buttons at your real MCQ Hub and Python Hub
  pages once built.
- **Colors/fonts**: all defined as CSS variables at the top of
  `css/style.css` under `:root`.

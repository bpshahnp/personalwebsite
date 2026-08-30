# B. Prasad Shah — Website

Plain HTML/CSS/JS site with a live Firebase database, so your "Latest
Updates" section stays in sync across every device automatically.

## File structure

```
bprasadshah/
├── index.html            → home page
├── mcq.html              → MCQ Hub — displays questions live from Firestore
├── admin.html            → Admin Panel — add/edit/delete questions & updates
├── css/style.css          → all styling
├── js/firebase-config.js  → connects to YOUR Firebase project + admin allowlist
├── js/script.js           → home page: nav, search, login, live "Latest Updates"
├── js/mcq.js              → renders/answers questions on mcq.html
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
3. Open `admin.html`, sign in, and you'll see two tabs: **Questions
   (MCQ Hub)** and **Latest Updates** — each with a form to add new
   entries and a list below it with Edit/Delete buttons on every entry.

⚠️ `ADMIN_EMAILS` only controls what the *page* shows. Anyone could
still write to Firestore directly unless you also lock it down with
security rules — see step 4 below.

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

Test mode allows anyone to read/write. Before launch, go to
**Firestore Database → Rules** and use something like this — it keeps
`ADMIN_EMAILS` in step 2 backed by a real server-side check, so only
those accounts can write, no matter who calls Firestore:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAdmin() {
      return request.auth != null &&
        request.auth.token.email in [
          "yourname@gmail.com"   // ← keep this in sync with ADMIN_EMAILS
        ];
    }

    match /updates/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /questions/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }
  }
}
```

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

/* ============================================
   firebase-config.js
   This is your "database file" — it connects the site
   to your Firebase project (Firestore = database,
   Auth = login/signup, Hosting = the live URL).

   1. Go to https://console.firebase.google.com
   2. Create a project (e.g. "b-prasad-shah")
   3. Project settings (gear icon) → General → "Your apps"
      → click the </> Web icon → register an app
   4. Firebase gives you a config object — paste YOUR
      real values below, replacing the placeholders.
   ============================================ */

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase (compat SDK, loaded via <script> tags in index.html)
firebase.initializeApp(firebaseConfig);

// Shared handles used across script.js / mcq.js / admin.js
const auth = firebase.auth();
const db = firebase.firestore();

/* ---------- Admin allowlist ----------
   Add the email address(es) that should be allowed to add/edit/delete
   questions and updates from admin.html. This list controls what the
   ADMIN PAGE shows — but by itself it does NOT stop someone from
   writing to Firestore directly. You must mirror this same list in
   your Firestore security rules (see README.md, section 4) so the
   database itself rejects writes from anyone else.
------------------------------------------------------------------- */
const ADMIN_EMAILS = [
  "you@example.com" // ← replace with your real login email
];

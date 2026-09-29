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

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDblaevAp_Mhg7nzJ7T-KHgCFOht1fklC8",
  authDomain: "bprasadshah-np.firebaseapp.com",
  projectId: "bprasadshah-np",
  storageBucket: "bprasadshah-np.firebasestorage.app",
  messagingSenderId: "324277525588",
  appId: "1:324277525588:web:548390a8d63cc0411de1c1",
  measurementId: "G-C7V657TN1B"
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
  "bholashroff345@gmail.com" // ← replace with your real login email
];

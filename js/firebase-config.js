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
  apiKey: "AIzaSyBbcikq94xF11ECeqJHBD4WXe8PCbZrkJg",
  authDomain: "personalwebsite-9b430.firebaseapp.com",
  databaseURL: "https://personalwebsite-9b430-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "personalwebsite-9b430",
  storageBucket: "personalwebsite-9b430.firebasestorage.app",
  messagingSenderId: "385218355179",
  appId: "1:385218355179:web:b07ddad4538f7aef9983ae",
  measurementId: "G-G5ZY2VQC5Y"
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

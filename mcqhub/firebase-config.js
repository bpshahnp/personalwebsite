/* =========================================================================
   FIREBASE CONFIG
   Replace the values below with your own Firebase project's config.
   Get this from: Firebase Console → Project settings (gear icon) →
   General tab → "Your apps" → Web app → SDK setup and configuration.

   This file is loaded before script.js and creates the global `db`
   object that script.js uses to read/write the shared leaderboard.
   ========================================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyCYObqMc783ZqsqriSFdY2Za7tZjDlj-BM",
  authDomain: "mcqhub-76dcd.firebaseapp.com",
  databaseURL: "https://mcqhub-76dcd-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "mcqhub-76dcd",
  storageBucket: "mcqhub-76dcd.firebasestorage.app",
  messagingSenderId: "203478212868",
  appId: "1:203478212868:web:8ee400cb62f542bb457051",
  measurementId: "G-GPGFR9BEXQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

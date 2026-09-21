# System Architecture Specification

> **Project:** B. Prasad Shah Educational Ecosystem  
> **Platform:** Progressive Web Architecture (PWA / Static SPA)  
> **Backend:** Firebase 10.x (Compat SDK)

---

## 1. System Architecture Diagram

```
+------------------------------------------------------------------------------------+
|                                    Client Tier                                     |
|                                                                                    |
|  +------------------+  +------------------+  +------------------+  +-------------+ |
|  |     MCQ Hub      |  |    Python Hub    |  |  Live Tournament |  |   Premium   | |
|  |   (mcq.html)     |  |  (python.html)   |  | (live-quiz.html) |  | (prem.html) | |
|  +--------+---------+  +--------+---------+  +--------+---------+  +------+------+ |
|           |                     |                     |                   |        |
|           +---------------------+---------------------+-------------------+        |
|                                 |                                                  |
|                   +-------------v-------------+                                    |
|                   | Shared Core Modules       |                                    |
|                   | - auth-widget.js          |                                    |
|                   | - nav-drawer.js           |                                    |
|                   | - style.css (Design Sys)  |                                    |
|                   +-------------+-------------+                                    |
+---------------------------------|--------------------------------------------------+
                                  |
                                  v
+------------------------------------------------------------------------------------+
|                                  Firebase Tier                                     |
|                                                                                    |
|   +-----------------------+   +-----------------------+   +--------------------+   |
|   | Firebase Auth         |   | Cloud Firestore       |   | Firebase Hosting   |   |
|   | - Google Sign-In      |   | - questions           |   | - Static Assets    |   |
|   | - Email / Password    |   | - pythonPrograms      |   | - Global CDN       |   |
|   | - Phone Verification  |   | - scores (Leaderboard)|   | - Custom Domain    |   |
|   |                       |   | - premiumUnlocks      |   |                    |   |
|   +-----------------------+   +-----------------------+   +--------------------+   |
+------------------------------------------------------------------------------------+
```

---

## 2. Core Subsystems

### 2.1. MCQ Quiz Engine (`js/mcq.js`)
- **Data Loading**: Subscribes to Firestore `questions` collection with client-side caching.
- **Filtering Pipeline**:
  1. `Class` selection (Class 8, 9, 10) filters candidate questions.
  2. `Category/Topic` dropdown populates dynamically from available questions in the selected class.
  3. `Question Count` picker (5, 10, 20, All) slices the randomized question set.
- **Session State**:
  - `currentQuestionIndex`: Active question pointer.
  - `score`: Live score accumulator.
  - `answersSummary`: Detailed record of selected options vs correct answers for the final review modal.
- **Progress Synchronization**:
  - Automatically calculates mastery percentage per topic.
  - Writes final attempt to `scores/{uid}` with top-level and class-level (`classStats[classLevel]`) averages.

### 2.2. Python Hub & Browser Execution (`js/python-hub.js`)
- **Program Repository**: Fetches runnable code snippets from `pythonPrograms` collection.
- **Search & Filter**: Real-time multi-token filter against titles, categories, and code strings.
- **Execution Architecture**:
  - Utilizes **Pyodide WebAssembly** worker (`js/pyodide-worker.js`).
  - Standard output (`sys.stdout`) and error traces (`sys.stderr`) are redirected to the UI terminal view underneath each code editor.
  - Completely sandboxed inside the user's browser—no server execution costs or backend vulnerabilities.

### 2.3. Live Weekly Tournament (`js/live-quiz.js`)
- **7-Day Tournament Cycle**:
  - Automatically determines current week number (`Week WW · YYYY`) and active day of the cycle (Day 1 Mon to Day 7 Sun).
  - Rotates questions daily at midnight local time.
- **Timer & Scoring**:
  - 25-second countdown per question with visual circular gauge.
  - Speed bonus calculation: faster correct answers yield up to +50 bonus points.
  - Optional sound synthesizer using Web Audio API (toggleable via UI).
- **Weekly Qualification**:
  - Top performers on Day 7 qualify for free automatic unlock of Premium Quiz access (`premiumUnlocks` collection).

### 2.4. Premium Quiz & Credit System (`js/premium.js`)
- **Access Control Matrix**:
  1. *Weekly Tournament Champions*: Automatically unlocked via `premiumUnlocks`.
  2. *Credit Balances*: Users consume credits (e.g. 3 credits per attempt) stored in `users/{uid}.credits`.
  3. *Annual Pass / Manual Verification*: Learners submit transaction screenshots & reference numbers from eSewa / Khalti. Submissions enter `premiumRequests` for administrator approval in `admin.html`.
- **Category / Level Filtering**:
  - Quizzes belong to categorized levels: `Beginners Level`, `Intermediate Level`, `Higher Level`, `Loksewa`, or custom admin-defined groups.
  - Category list configuration is stored in `siteSettings/premiumCategories`.
  - Frontend renders responsive filter chips with real-time question counts and instant card grid filtering.

---

## 3. Database Schema (Cloud Firestore)

| Collection | Document ID | Purpose | Access Control |
| :--- | :--- | :--- | :--- |
| `updates` | Auto ID | Announcements shown on homepage | Public Read / Admin Write |
| `questions` | Auto ID | MCQ Hub question bank with `classLevel` | Public Read / Admin Write |
| `pythonPrograms` | Auto ID | Python Hub code snippets and descriptions | Public Read / Admin Write |
| `resources` | Auto ID | Google Drive links for notes and study guides | Public Read / Admin Write |
| `messages` | Auto ID | Inbound contact form submissions | Public Create / Admin Read & Delete |
| `scores` | User UID | Leaderboard documents (lifetime & per-class stats) | Public Read / Own User Write |
| `liveQuizScores` | Auto ID | Daily tournament attempts and speed metrics | Public Read / Auth User Write |
| `liveQuizQuestions`| Auto ID | Tournament question pool | Public Read / Admin Write |
| `premiumQuizContent`| Auto ID| Premium question banks | Public Read / Admin Write |
| `premiumUnlocks` | Auto ID | Granted premium licenses (earned or purchased) | Own User Read / Admin Write |
| `users` | User UID | User profiles, credit balances, and verified phones | Own User Read & Write / Admin Full |
| `payments` | Auto ID | Transaction logs (Khalti / eSewa) | Own User Read & Create / Admin Full |
| `premiumRequests` | Auto ID | Manual payment verification tickets | Own User Read & Create / Admin Full |
| `siteSettings` | Fixed ID | Global configuration (e.g. pass thresholds) | Public Read / Admin Write |

---

## 4. Security Architecture

1. **Authentication Layer**:
   - Google OAuth Provider and Email/Password credentials through Firebase Authentication.
   - User sessions managed securely via Firebase Token Refresh.
2. **Authorization Layer (`firestore.rules`)**:
   - Database operations are strictly enforced at the Firestore server level.
   - Client-side checks (e.g., hiding admin tabs or buttons) are strictly ergonomic and backed by server validation.
3. **Data Integrity**:
   - Scores cannot be submitted for other users (`request.auth.uid == uid`).
   - Educational content (`questions`, `pythonPrograms`) cannot be modified or deleted without a valid token email matching `ADMIN_EMAILS`.

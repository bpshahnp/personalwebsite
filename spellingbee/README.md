# Om Shanti Academy — Online Spelling Bee

This version is built for Firebase Hosting + Firebase Authentication + Cloud Firestore. It keeps the main screens within the viewport so normal scrolling is not required. Long round/question lists are paginated in the competition screen; the admin lists are compact.

## 1. Firebase setup
1. Create a Firebase project and register a Web App.
2. Enable **Authentication → Email/Password**.
3. Create a **Cloud Firestore** database.
4. Copy the Web App configuration into `firebase-config.js`.
5. Create your first admin user in Authentication.
6. Give that user's account the custom claim `{ "admin": true }` using a trusted Admin SDK environment. Do not put Admin SDK credentials in this website.
7. Deploy `firestore.rules` and the site.

Firebase's current browser-module docs show the `https://www.gstatic.com/firebasejs/12.18.0/firebase-*.js` pattern used here.

## 2. Set the admin claim
Use Firebase Admin SDK from a secure machine/server, for example: `getAuth().setCustomUserClaims(uid, { admin: true })`. The user should sign out/in again (or refresh their ID token) after the claim is set.

## 3. Data model
- `competition/settings` — school name, title, location, page size
- `rounds/{roundId}` — round name/order
- `rounds/{roundId}/questions/{questionId}` — prompt, correct word, points, status
- `teams/{teamId}` — team/house name, order, score

## 4. Put the school logo here
`assets/school_logo.png`

## 5. Deploy
Install Firebase CLI, run `firebase login`, then `firebase init hosting firestore` in this folder, or use the included `firebase.json`. Set the correct project ID in the Firebase CLI configuration and deploy with `firebase deploy`.

## Security note
The competition round is deliberately admin-authenticated because it contains the correct answers. Public visitors can view the home page, rules and scoreboard, but Firestore writes are restricted to admins by the rules. For stronger secrecy, answers can later be moved to an admin-only subcollection and checked through a callable Cloud Function.

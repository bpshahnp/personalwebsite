/* ============================================
   contact.js — submits the query form to Firestore.
   Collection: "messages"
   Doc shape: { name, email, subject, message, createdAt }
   Public CREATE only (see firestore.rules) — visitors can send a
   message but can't read anyone else's. Admin reads/manages them
   from admin.html.
   ============================================ */

const contactForm = document.getElementById("contactForm");
const cfStatus = document.getElementById("cfStatus");
const cfSubmitBtn = document.getElementById("cfSubmitBtn");

contactForm.addEventListener("submit", (e) => {
  e.preventDefault();
  cfStatus.style.color = "";
  cfStatus.textContent = "";
  cfSubmitBtn.disabled = true;
  cfSubmitBtn.textContent = "Sending…";

  const payload = {
    name: document.getElementById("cfName").value.trim(),
    email: document.getElementById("cfEmail").value.trim(),
    subject: document.getElementById("cfSubject").value.trim(),
    message: document.getElementById("cfMessage").value.trim(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  db.collection("messages")
    .add(payload)
    .then(() => {
      cfStatus.style.color = "green";
      cfStatus.textContent = "Message sent — thanks! You'll hear back at the email you provided.";
      contactForm.reset();
    })
    .catch((err) => {
      cfStatus.style.color = "crimson";
      cfStatus.textContent = `Could not send message (${err.message}).`;
    })
    .finally(() => {
      cfSubmitBtn.disabled = false;
      cfSubmitBtn.textContent = "Send message";
    });
});

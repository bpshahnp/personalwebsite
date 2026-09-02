/* ============================================
   resources.js — renders the "resources" Firestore
   collection: links to files hosted on Google Drive
   (no file storage on this site — see admin.js for
   how entries get added).
   Doc shape:
   {
     title: string,
     description: string,
     fileType: string,   // "PPT" | "Word" | "PDF" | "Excel" | "Other"
     driveUrl: string,
     category: string,
     order: number
   }
   ============================================ */

const resourceList = document.getElementById("resourceList");
const resourceCategoryFilter = document.getElementById("resourceCategoryFilter");

const FILE_ICONS = {
  PPT: "📊",
  Word: "📄",
  PDF: "📕",
  Excel: "📈",
  Other: "📁",
};

let allResources = [];

db.collection("resources")
  .orderBy("order", "desc")
  .onSnapshot(
    (snapshot) => {
      allResources = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderCategoryOptions();
      renderResources();
    },
    (err) => {
      resourceList.innerHTML = `<p class="updates-loading">Could not load resources (${err.message}).</p>`;
    }
  );

function renderCategoryOptions() {
  const categories = ["All", ...new Set(allResources.map((r) => r.category).filter(Boolean))];
  const current = resourceCategoryFilter.value || "All";
  resourceCategoryFilter.innerHTML = categories
    .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
    .join("");
  if (categories.includes(current)) resourceCategoryFilter.value = current;
}

function renderResources() {
  const filterValue = resourceCategoryFilter.value || "All";
  const list = filterValue === "All" ? allResources : allResources.filter((r) => r.category === filterValue);

  if (!list.length) {
    resourceList.innerHTML = `<p class="updates-loading">No resources yet — check back soon.</p>`;
    return;
  }

  resourceList.innerHTML = "";
  list.forEach((r) => {
    const card = document.createElement("article");
    card.className = "resource-card";
    const icon = FILE_ICONS[r.fileType] || FILE_ICONS.Other;
    card.innerHTML = `
      <div class="resource-icon">${icon}</div>
      <div class="resource-body">
        <div class="resource-head">
          <h3>${escapeHtml(r.title || "Untitled")}</h3>
          ${r.category ? `<span class="mcq-category">${escapeHtml(r.category)}</span>` : ""}
        </div>
        ${r.description ? `<p class="resource-desc">${escapeHtml(r.description)}</p>` : ""}
      </div>
      <a href="${escapeAttr(r.driveUrl || "#")}" target="_blank" rel="noopener" class="btn btn-secondary resource-download">Download</a>
    `;
    resourceList.appendChild(card);
  });
}

resourceCategoryFilter.addEventListener("change", renderResources);

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

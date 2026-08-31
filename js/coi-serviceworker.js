/* coi-serviceworker.js
   Enables crossOriginIsolated (COOP/COEP) on static hosts like GitHub Pages
   that can't set custom HTTP headers, so SharedArrayBuffer becomes
   available — required for the Pyodide worker to block on input() the
   way Thonny/replit-style runners do.

   Include this as the FIRST script in <head>, before anything else:
     <script src="coi-serviceworker.js"></script>

   First-time visitors get one automatic, silent reload while the service
   worker installs. After that, the page loads already isolated.
*/
(function () {
  if (typeof window === "undefined") {
    // We're running *as* the service worker itself.
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
    self.addEventListener("fetch", (event) => {
      if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") return;
      event.respondWith(
        fetch(event.request)
          .then((response) => {
            if (response.status === 0) return response;
            const headers = new Headers(response.headers);
            headers.set("Cross-Origin-Embedder-Policy", "require-corp");
            headers.set("Cross-Origin-Opener-Policy", "same-origin");
            return new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers,
            });
          })
          .catch((e) => new Response(String(e), { status: 500 }))
      );
    });
    return;
  }

  // We're running on the page.
  if (window.crossOriginIsolated) return; // already isolated, nothing to do
  if (!window.isSecureContext) {
    console.warn("coi-serviceworker: requires https (GitHub Pages is fine).");
    return;
  }
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker
    .register(window.document.currentScript.src)
    .then((reg) => {
      // Reload once the worker takes control so headers apply to this load.
      if (reg.active && !navigator.serviceWorker.controller) {
        window.location.reload();
      }
      reg.addEventListener("updatefound", () => window.location.reload());
    })
    .catch((e) => console.error("coi-serviceworker registration failed:", e));
})();

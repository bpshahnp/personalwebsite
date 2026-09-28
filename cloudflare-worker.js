/**
 * ================================================================
 * Cloudflare Worker — Dynamic OG Meta Tag Injector
 * ================================================================
 * Deploy this worker at: workers.dev or as a route on your domain.
 *
 * WHAT IT DOES:
 *   When a social media crawler (Facebook, Twitter/X, WhatsApp,
 *   Telegram, LinkedIn, etc.) requests:
 *
 *     https://bholaprasadshah.com.np/quiz-share.html?id=<quiz_id>
 *
 *   this Worker:
 *     1. Detects the crawler via User-Agent
 *     2. Fetches quiz data from Firestore REST API
 *     3. Injects the correct og:image, og:title, og:description
 *        into the HTML <head> before serving it
 *
 *   Regular browser requests are passed through unchanged.
 *
 * HOW TO DEPLOY:
 *   Option A — Cloudflare Dashboard (easiest):
 *     1. Go to https://dash.cloudflare.com → Workers & Pages → Create
 *     2. Click "Create Worker", paste this entire file, click Deploy.
 *     3. Go to Settings → Triggers → Add Route:
 *          bholaprasadshah.com.np/quiz-share.html*
 *     4. Done. Test with: https://www.opengraph.xyz/url/...
 *
 *   Option B — Wrangler CLI:
 *     npm install -g wrangler
 *     wrangler login
 *     wrangler deploy
 *
 * COSTS: Cloudflare Workers free tier = 100,000 req/day. Plenty.
 * ================================================================
 */

// ── CONFIG ──────────────────────────────────────────────────────
const FIRESTORE_PROJECT = "personalwebsite-9b430";
const SITE_ORIGIN       = "https://bholaprasadshah.com.np";
const DEFAULT_OG_IMAGE  = `${SITE_ORIGIN}/assets/og-image.png`;
const DEFAULT_OG_TITLE  = "Premium Quiz Portal | B. Prasad Shah";
const DEFAULT_OG_DESC   = "Challenge yourself with premium competitive quizzes. Sign up free and get 2 starter credits!";
// ────────────────────────────────────────────────────────────────

/**
 * Detects whether the incoming request is from a social media bot/
 * crawler that reads OG meta tags. We only do expensive Firestore
 * lookups for these bots; normal browsers get the page as-is.
 */
function isSocialCrawler(userAgent = "") {
  const ua = userAgent.toLowerCase();
  return (
    ua.includes("facebookexternalhit") ||
    ua.includes("twitterbot") ||
    ua.includes("linkedinbot") ||
    ua.includes("whatsapp") ||
    ua.includes("telegrambot") ||
    ua.includes("slackbot") ||
    ua.includes("discordbot") ||
    ua.includes("applebot") ||
    ua.includes("googlebot") ||
    ua.includes("bingbot") ||
    ua.includes("pinterestbot") ||
    ua.includes("vkshare") ||
    ua.includes("redditbot") ||
    ua.includes("outbrain") ||
    ua.includes("quora link preview") ||
    ua.includes("rogerbot") ||
    ua.includes("semrushbot") ||
    ua.includes("ahrefsbot") ||
    ua.includes("crawler") ||
    ua.includes("spider") ||
    ua.includes("bot/")
  );
}

/**
 * Map Firestore field value object → plain JS value.
 * Firestore REST API returns fields like:
 *   { "name": { "stringValue": "My Quiz" } }
 */
function firestoreValue(fieldObj) {
  if (!fieldObj) return null;
  return (
    fieldObj.stringValue ??
    fieldObj.integerValue ??
    fieldObj.doubleValue ??
    fieldObj.booleanValue ??
    null
  );
}

/**
 * Fetch quiz document from Firestore REST (no auth needed for public data).
 */
async function fetchQuizData(quizId) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents/premiumQuizContent/${encodeURIComponent(quizId)}`;
  const res  = await fetch(url, { cf: { cacheEverything: true, cacheTtl: 300 } });
  if (!res.ok) return null;
  const json = await res.json();
  if (json.error || !json.fields) return null;
  return json.fields;
}

/**
 * Inject OG meta tags into the HTML string.
 * We replace the placeholder <meta> tags that are already in the HTML.
 */
function injectOgTags(html, { title, description, imageUrl, quizId }) {
  const canonicalUrl = `${SITE_ORIGIN}/quiz-share.html?id=${encodeURIComponent(quizId)}`;
  const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");

  const og = `
  <!-- Injected by Cloudflare Worker for quiz: ${escapeHtml(quizId)} -->
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="B. Prasad Shah" />
  <meta property="og:url" content="${esc(canonicalUrl)}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:image" content="${esc(imageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${esc(title)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${esc(imageUrl)}" />
`;

  // Replace everything between <!-- Default OG tags --> comment and the closing
  // meta twitter:image tag. We do a broad replacement that finds the block.
  // Strategy: inject before </head>
  return html.replace(/<\/head>/, og + "\n</head>");
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── MAIN HANDLER ────────────────────────────────────────────────
addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  // Only intercept requests to /quiz-share.html
  if (!url.pathname.includes("quiz-share.html")) {
    return fetch(request);
  }

  const quizId      = url.searchParams.get("id") || url.searchParams.get("quiz");
  const userAgent   = request.headers.get("User-Agent") || "";
  const isCrawler   = isSocialCrawler(userAgent);

  // Pass non-crawler requests through unchanged (fast path)
  if (!isCrawler || !quizId) {
    return fetch(request);
  }

  // ── CRAWLER PATH: Fetch quiz data & inject OG tags ──────────
  try {
    const [fields, originalResp] = await Promise.all([
      fetchQuizData(quizId),
      fetch(request)
    ]);

    const originalHtml = await originalResp.text();

    // Build OG values
    let ogTitle       = DEFAULT_OG_TITLE;
    let ogDescription = DEFAULT_OG_DESC;
    let ogImage       = DEFAULT_OG_IMAGE;

    if (fields) {
      const name        = firestoreValue(fields.name)        || "Premium Quiz";
      const description = firestoreValue(fields.description) || "A timed competitive examination quiz.";
      const imageUrl    = firestoreValue(fields.imageUrl)    || null;
      const credits     = Number(firestoreValue(fields.credits) || 3);
      const qCount      = Number(firestoreValue(fields.questionCount) || 0);

      ogTitle = `${name} | B. Prasad Shah's Quiz Portal`;
      ogDescription = [
        description,
        `${qCount > 0 ? qCount + " questions · " : ""}${credits} credit${credits === 1 ? "" : "s"} to play.`,
        "Sign up free and get 2 starter credits!"
      ].join(" ");

      // Only use quiz image if it's a real public URL (http/https)
      if (imageUrl && /^https?:\/\//i.test(imageUrl)) {
        ogImage = imageUrl;
      }
    }

    const injectedHtml = injectOgTags(originalHtml, {
      title:       ogTitle,
      description: ogDescription,
      imageUrl:    ogImage,
      quizId:      quizId
    });

    return new Response(injectedHtml, {
      status:  originalResp.status,
      headers: {
        "Content-Type":  "text/html; charset=UTF-8",
        "Cache-Control": "public, max-age=300",  // cache for 5 min
        "X-OG-Injected": "1",
        "X-Quiz-ID":     quizId
      }
    });

  } catch (err) {
    // On any error, serve the original page unmodified
    console.error("Worker OG injection error:", err);
    return fetch(request);
  }
}

/**
 * ================================================================
 * Cloudflare Worker — Dynamic OG Meta Tag Injector for Quiz Cards
 * ================================================================
 *
 * WHAT IT DOES:
 *   When Facebook, WhatsApp, Twitter/X, Telegram, or LinkedIn
 *   crawlers request a quiz share link, this worker:
 *
 *     1. Detects the crawler via User-Agent
 *     2. Reads ?id= or ?quiz= from the URL
 *     3. Fetches quiz data (name, description, imageUrl) from Firestore
 *     4. STRIPS the default generic OG tags from the HTML
 *     5. INJECTS quiz-specific og:image, og:title, og:description
 *
 *   This works for BOTH URL formats:
 *     - https://bholaprasadshah.com.np/quiz-share.html?id=<quiz_id>
 *     - https://bholaprasadshah.com.np/premium.html?quiz=<quiz_id>
 *
 *   Regular browser requests are passed through unchanged (fast).
 *
 * ── HOW TO DEPLOY (Dashboard — no CLI needed) ────────────────────
 *
 *   STEP 1: Go to https://dash.cloudflare.com
 *   STEP 2: Click "Workers & Pages" in the left menu
 *   STEP 3: Click "Create" → "Create Worker"
 *   STEP 4: Delete the default code, paste THIS entire file
 *   STEP 5: Click "Deploy"
 *   STEP 6: In your new worker page, click "Settings" tab
 *           → "Triggers" → "Add Route"
 *
 *   Add THESE TWO routes (one per line, add both):
 *     bholaprasadshah.com.np/quiz-share.html*
 *     bholaprasadshah.com.np/premium.html*
 *
 *   STEP 7: Done! Test at:
 *     https://developers.facebook.com/tools/debug/
 *     (enter: https://bholaprasadshah.com.np/quiz-share.html?id=YOUR_QUIZ_ID)
 *
 *   NOTE: Facebook caches OG data. After deploying, paste any old
 *   shared link into the Facebook Sharing Debugger and click
 *   "Scrape Again" to clear the cache.
 *
 * COSTS: Cloudflare Workers Free Tier = 100,000 requests/day. Free.
 * ================================================================
 */

// ── CONFIG ──────────────────────────────────────────────────────────────────
const FIRESTORE_PROJECT = "personalwebsite-9b430";
const SITE_ORIGIN       = "https://bholaprasadshah.com.np";
const DEFAULT_OG_IMAGE  = `${SITE_ORIGIN}/assets/og-image.png`;
const DEFAULT_OG_TITLE  = "Premium Quiz Portal | B. Prasad Shah";
const DEFAULT_OG_DESC   = "Challenge yourself with premium competitive quizzes. Sign up free and get 2 starter credits!";
// ────────────────────────────────────────────────────────────────────────────

// ── CRAWLER DETECTION ────────────────────────────────────────────────────────
/**
 * Returns true if the User-Agent is a social media / search crawler.
 * Only crawlers get the expensive Firestore lookup — real users skip it.
 */
function isSocialCrawler(userAgent = "") {
  const ua = userAgent.toLowerCase();
  return (
    ua.includes("facebookexternalhit") ||  // Facebook / Messenger
    ua.includes("facebot") ||
    ua.includes("twitterbot") ||           // Twitter / X
    ua.includes("linkedinbot") ||          // LinkedIn
    ua.includes("whatsapp") ||             // WhatsApp
    ua.includes("telegrambot") ||          // Telegram
    ua.includes("slackbot") ||             // Slack
    ua.includes("discordbot") ||           // Discord
    ua.includes("applebot") ||             // Apple
    ua.includes("googlebot") ||            // Google search
    ua.includes("bingbot") ||              // Bing
    ua.includes("pinterestbot") ||         // Pinterest
    ua.includes("vkshare") ||              // VK
    ua.includes("redditbot") ||            // Reddit
    ua.includes("quora link preview") ||   // Quora
    ua.includes("outbrain") ||
    ua.includes("rogerbot") ||
    ua.includes("semrushbot") ||
    ua.includes("ahrefsbot") ||
    ua.includes("crawler") ||
    ua.includes("spider") ||
    ua.includes("bot/")
  );
}

// ── FIRESTORE REST HELPERS ───────────────────────────────────────────────────
/** Unwrap a Firestore field value object to a plain JS value */
function fsVal(f) {
  if (!f) return null;
  return f.stringValue ?? f.integerValue ?? f.doubleValue ?? f.booleanValue ?? null;
}

/** Fetch a single premiumQuizContent document by ID via Firestore REST */
async function fetchQuizData(quizId) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}` +
    `/databases/(default)/documents/premiumQuizContent/${encodeURIComponent(quizId)}`;

  const res = await fetch(url, {
    cf: { cacheEverything: true, cacheTtl: 300 }   // cache 5 min at edge
  });
  if (!res.ok) return null;
  const json = await res.json();
  if (json.error || !json.fields) return null;
  return json.fields;
}

// ── HTML TRANSFORMATION ──────────────────────────────────────────────────────
const esc = (s) =>
  String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Remove ALL existing <title>, <meta name="description">,
 * and all og: / twitter: meta tags so there are no duplicates.
 */
function stripOgTags(html) {
  return html
    // <title>…</title>
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "")
    // self-closing <meta …/> — og:, twitter:, description
    .replace(/<meta\s[^>]*(property|name)="(og:|twitter:|description)[^"]*"[^>]*\/?>/gi, "")
    // just in case they're not self-closing
    .replace(/<meta\s[^>]*(property|name)="(og:|twitter:|description)[^"]*"[^>]*><\/meta>/gi, "");
}

/**
 * Build the complete OG + Twitter meta block and insert it into <head>.
 */
function injectOgTags(html, { title, description, imageUrl, canonicalUrl }) {
  const block = `
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
  <meta name="twitter:image" content="${esc(imageUrl)}" />`;

  // Insert immediately after <head> (before anything else)
  return html.replace(/(<head[^>]*>)/i, `$1\n${block}`);
}

/** Build quiz-specific OG values from Firestore fields */
function buildOgValues(fields, quizId, isSharePage) {
  const name        = fsVal(fields.name)        || "Premium Quiz";
  const description = fsVal(fields.description) || "A timed competitive examination quiz on B. Prasad Shah's Portal.";
  const imageUrl    = fsVal(fields.imageUrl)    || null;
  const credits     = Number(fsVal(fields.credits) || 3);
  const qCount      = Number(fsVal(fields.questionCount) || 0);

  const ogTitle = `${name} — Free Quiz Challenge | B. Prasad Shah`;
  const ogDesc  = [
    description,
    `${qCount > 0 ? qCount + " questions · " : ""}${credits} credit${credits === 1 ? "" : "s"} to play.`,
    "Sign up free and start immediately!"
  ].filter(Boolean).join(" ");

  // Use the quiz imageUrl only if it's a valid public URL
  const ogImage = (imageUrl && /^https?:\/\//i.test(imageUrl))
    ? imageUrl
    : DEFAULT_OG_IMAGE;

  // Canonical URL always points to quiz-share.html for clean link previews
  const canonicalUrl = `${SITE_ORIGIN}/quiz-share.html?id=${encodeURIComponent(quizId)}`;

  return { title: ogTitle, description: ogDesc, imageUrl: ogImage, canonicalUrl };
}

// ── MAIN FETCH HANDLER ───────────────────────────────────────────────────────
addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url       = new URL(request.url);
  const pathname  = url.pathname;
  const ua        = request.headers.get("User-Agent") || "";

  // Only process quiz share URLs
  const isSharePage   = pathname.endsWith("quiz-share.html");
  const isPremiumPage = pathname.endsWith("premium.html");

  if (!isSharePage && !isPremiumPage) {
    return fetch(request);
  }

  // Extract quiz ID from either ?id= or ?quiz=
  const quizId = url.searchParams.get("id") || url.searchParams.get("quiz");

  // No quiz ID, or not a crawler — pass through untouched
  if (!quizId || !isSocialCrawler(ua)) {
    return fetch(request);
  }

  // ── CRAWLER + quiz ID: fetch quiz and inject OG tags ────────────────────
  try {
    // Fetch quiz data and original HTML in parallel
    const [fields, originalResp] = await Promise.all([
      fetchQuizData(quizId),
      fetch(request)
    ]);

    const rawHtml = await originalResp.text();

    let ogValues;
    if (fields) {
      ogValues = buildOgValues(fields, quizId, isSharePage);
    } else {
      // Quiz not found — use defaults
      ogValues = {
        title:        DEFAULT_OG_TITLE,
        description:  DEFAULT_OG_DESC,
        imageUrl:     DEFAULT_OG_IMAGE,
        canonicalUrl: `${SITE_ORIGIN}/quiz-share.html?id=${encodeURIComponent(quizId)}`
      };
    }

    // 1. Strip all old OG/title/description tags
    const strippedHtml = stripOgTags(rawHtml);
    // 2. Inject the quiz-specific tags at the top of <head>
    const finalHtml = injectOgTags(strippedHtml, ogValues);

    return new Response(finalHtml, {
      status: originalResp.status,
      headers: {
        "Content-Type":  "text/html; charset=UTF-8",
        "Cache-Control": "public, max-age=300",    // edge-cache 5 min
        "Vary":          "User-Agent",
        "X-OG-Worker":  `quiz:${quizId}`,
        // Preserve important original headers
        ...Object.fromEntries(
          ["X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy"]
            .map(h => [h, originalResp.headers.get(h)])
            .filter(([, v]) => v)
        )
      }
    });

  } catch (err) {
    // On any error, serve original page unchanged — never break the site
    console.error("OG Worker error:", err.message);
    return fetch(request);
  }
}

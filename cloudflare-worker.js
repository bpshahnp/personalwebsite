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
 *     2. Reads ?id= (or ?quiz=) from the URL
 *     3. Reads ?t= (title), ?img= (image), ?d= (description) from URL params
 *        -> FAST PATH: Injects metadata immediately without DB dependency!
 *     4. If params missing, fetches from Firestore REST API
 *     5. If Firestore is down/quota-limited, formats quiz slug into a clean title
 *     6. STRIPS default generic OG tags from the HTML
 *     7. INJECTS quiz-specific og:image, og:title, og:description
 *
 *   This works for BOTH URL formats:
 *     - https://bholaprasadshah.com.np/quiz-share.html?id=<quiz_id>
 *     - https://bholaprasadshah.com.np/premium.html?quiz=<quiz_id>
 *
 *   Regular browser requests are passed through unchanged (fast).
 * ================================================================
 */

// ── CONFIG ──────────────────────────────────────────────────────────────────
const FIRESTORE_PROJECT = "personalwebsite-9b430";
const FIREBASE_API_KEY  = "AIzaSyBbcikq94xF11ECeqJHBD4WXe8PCbZrkJg";
const SITE_ORIGIN       = "https://bholaprasadshah.com.np";
const DEFAULT_OG_IMAGE  = `${SITE_ORIGIN}/assets/og-image.png`;
const DEFAULT_OG_TITLE  = "Premium Quiz Portal | B. Prasad Shah";
const DEFAULT_OG_DESC   = "Challenge yourself with premium competitive quizzes. Sign up free and get 2 starter credits!";
// ────────────────────────────────────────────────────────────────────────────

// ── CRAWLER DETECTION ────────────────────────────────────────────────────────
function isSocialCrawler(userAgent = "") {
  const ua = userAgent.toLowerCase();
  return (
    ua.includes("facebookexternalhit") ||
    ua.includes("facebot") ||
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
    ua.includes("quora link preview") ||
    ua.includes("outbrain") ||
    ua.includes("rogerbot") ||
    ua.includes("semrushbot") ||
    ua.includes("ahrefsbot") ||
    ua.includes("crawler") ||
    ua.includes("spider") ||
    ua.includes("bot/")
  );
}

// ── HELPERS ──────────────────────────────────────────────────────────────────
function fsVal(f) {
  if (!f) return null;
  return f.stringValue ?? f.integerValue ?? f.doubleValue ?? f.booleanValue ?? null;
}

function slugToTitle(slug) {
  if (!slug) return "Premium Quiz";
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bI\b/g, "I")
    .replace(/\bIi\b/g, "II")
    .replace(/\bIii\b/g, "III")
    .replace(/\bIv\b/g, "IV")
    .replace(/\bGk\b/g, "GK")
    .trim();
}

const esc = (s) =>
  String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

async function fetchQuizData(quizId) {
  try {
    const url =
      `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}` +
      `/databases/(default)/documents/premiumQuizContent/${encodeURIComponent(quizId)}?key=${FIREBASE_API_KEY}`;

    const res = await fetch(url, {
      cf: { cacheEverything: true, cacheTtl: 3600 }
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.error || !json.fields) return null;
    return json.fields;
  } catch (_) {
    return null;
  }
}

function stripOgTags(html) {
  return html
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/<meta\s[^>]*(property|name)="(og:|twitter:|description)[^"]*"[^>]*\/?>/gi, "")
    .replace(/<meta\s[^>]*(property|name)="(og:|twitter:|description)[^"]*"[^>]*><\/meta>/gi, "");
}

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

  return html.replace(/(<head[^>]*>)/i, `$1\n${block}`);
}

function buildOgFromFields(fields, quizId, canonicalUrl) {
  const name        = fsVal(fields.name)        || slugToTitle(quizId);
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

  const ogImage = (imageUrl && /^https?:\/\//i.test(imageUrl))
    ? imageUrl
    : DEFAULT_OG_IMAGE;

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

  const isSharePage   = pathname.endsWith("quiz-share.html");
  const isPremiumPage = pathname.endsWith("premium.html");

  if (!isSharePage && !isPremiumPage) {
    return fetch(request);
  }

  const quizId = url.searchParams.get("id") || url.searchParams.get("quiz");

  if (!quizId || !isSocialCrawler(ua)) {
    return fetch(request);
  }

  try {
    const paramTitle = url.searchParams.get("t")   || url.searchParams.get("title");
    const paramImg   = url.searchParams.get("img") || url.searchParams.get("image");
    const paramDesc  = url.searchParams.get("d")   || url.searchParams.get("desc");

    let ogValues = null;

    // 1. FAST PATH: Check if title and/or image are provided directly in URL query params
    if (paramTitle || paramImg) {
      const rawTitle = paramTitle || slugToTitle(quizId);
      const title    = `${rawTitle} — Free Quiz Challenge | B. Prasad Shah`;
      const desc     = paramDesc
        ? `${paramDesc} Play now on B. Prasad Shah's Portal!`
        : `Challenge yourself with ${rawTitle}. Sign up free and play!`;
      const img      = (paramImg && /^https?:\/\//i.test(paramImg))
        ? paramImg
        : DEFAULT_OG_IMAGE;

      ogValues = {
        title,
        description: desc,
        imageUrl: img,
        canonicalUrl: request.url
      };
    }

    // 2. FALLBACK PATH: If URL didn't have params, fetch from Firestore
    if (!ogValues) {
      const fields = await fetchQuizData(quizId);
      if (fields) {
        ogValues = buildOgFromFields(fields, quizId, request.url);
      } else {
        // If Firestore is quota-limited or unavailable, derive from the quiz slug!
        const prettyName = slugToTitle(quizId);
        ogValues = {
          title:        `${prettyName} — Free Quiz Challenge | B. Prasad Shah`,
          description:  `Challenge yourself with ${prettyName} on B. Prasad Shah's Portal. Sign up free and play!`,
          imageUrl:     DEFAULT_OG_IMAGE,
          canonicalUrl: request.url
        };
      }
    }

    // Fetch the underlying static page
    const originalResp = await fetch(request);
    const rawHtml      = await originalResp.text();

    // Strip old OG tags and inject new ones
    const strippedHtml = stripOgTags(rawHtml);
    const finalHtml    = injectOgTags(strippedHtml, ogValues);

    return new Response(finalHtml, {
      status: originalResp.status,
      headers: {
        "Content-Type":  "text/html; charset=UTF-8",
        "Cache-Control": "public, max-age=300",
        "Vary":          "User-Agent",
        "X-OG-Worker":   `quiz:${quizId}`,
        "X-OG-Source":   paramTitle || paramImg ? "url-params" : "firestore-or-slug"
      }
    });

  } catch (err) {
    console.error("OG Worker error:", err.message);
    return fetch(request);
  }
}

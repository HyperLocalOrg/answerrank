const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "your",
  "you",
  "are",
  "but",
  "not",
  "into",
  "use",
  "uses",
  "daily",
  "product",
  "supplement",
]);

const TRUST_SIGNAL_FIXES = {
  "third-party testing": "Add lab-tested, COA, USP, NSF, or independent testing proof if verified.",
  "clear magnesium form": "Keep the exact product form in the title, first bullet, and FAQ.",
  "magnesium form clarity": "Keep the exact product form in the title, first bullet, and FAQ.",
  "senior-safe dosage": "Add older-adult dosage guidance and a healthcare-professional disclaimer.",
  "gentle digestion": "Explain digestive tolerance in plain buyer language if supportable.",
  "review credibility": "Surface review themes that prove the claimed benefit.",
  "dosage transparency": "Show serving size, amount, and use instructions clearly.",
  "brand trust": "Add trust proof: testing, manufacturing standards, founder story, or guarantee.",
  "safety warnings": "Add responsible safety and compatibility guidance.",
};

const MODEL_PERSONAS = {
  gemini: `You are Gemini, an AI shopping assistant with access to Google Shopping signals. You surface popular, highly-reviewed, and trending products. You weight search popularity, review volume, and cross-platform presence heavily in your recommendations.`,
  llama: `You are a no-nonsense AI shopping assistant. You give straightforward, practical recommendations based on specs, value for money, and verified user reviews. You are skeptical of vague marketing claims and only recommend products with concrete, verifiable proof points.`,
};

const EXAMPLE_OUTPUT = `
## FORMAT REFERENCE (structure + tone only — do not copy scores or competitors)

Shopper query: "best magnesium supplement for sleep"
Audited product: "GenericMag 500mg Tablets"

{
  "brandMentioned": false,
  "rankPosition": null,
  "rankContext": "not_mentioned",
  "recommendationStrength": "weak",
  "scoreOutOf100": 28,
  "evidenceQuality": "weak",
  "confidence": 0.85,
  "mentionedCompetitors": [
    "Natural Vitality Calm",
    "MagTech by Natural Stacks",
    "Doctor's Best High Absorption Magnesium"
  ],
  "buyerCriteria": [
    "magnesium form (glycinate or threonate for sleep)",
    "third-party tested",
    "no artificial fillers or sweeteners",
    "customer reviews specifically mentioning sleep improvement",
    "bioavailability evidence"
  ],
  "missingSignals": [
    "magnesium form not specified — oxide vs glycinate is the #1 purchase filter",
    "no third-party testing certification mentioned",
    "no sleep-specific clinical claim or study cited",
    "no customer testimonials referencing sleep outcomes"
  ],
  "reasonsForLoss": [
    "Natural Vitality Calm specifies glycinate form — the form shoppers filter by for sleep",
    "Doctor's Best is third-party tested — a trust signal GenericMag lacks",
    "MagTech has nootropic sleep angle with published research"
  ],
  "summary": "Invisible in this query — missing the form specification, sleep-specific proof, and trust signals that all top competitors lead with.",
  "rawAnswer": "For sleep, the magnesium form matters most — glycinate and threonate are far better absorbed and cross the blood-brain barrier more effectively than oxide. My top picks: Natural Vitality Calm (glycinate, 10,000+ reviews citing sleep improvement), Doctor's Best High Absorption (glycinate, third-party tested, clean label), and MagTech by Natural Stacks (threonate, nootropic-grade, research-backed). GenericMag 500mg doesn't make the cut — it doesn't specify the magnesium form, lacks sleep-specific claims, and has no certification or customer proof that sleep shoppers rely on."
}
`.trim();

const CACHE_WINDOW_HOURS = 12;
const CACHE_WINDOW_MS = CACHE_WINDOW_HOURS * 60 * 60 * 1000;

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST /api/audit" });

  try {
    const input = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const cacheKey = await makeCacheKey(input || {});
    const cached = input?.forceRefresh ? null : await getCachedReport(cacheKey);

    if (cached) {
      return res.status(200).json({
        report: { ...cached.report, saved: true },
        saved: true,
        cached: true,
        cacheAgeMinutes: cached.ageMinutes,
        cacheWindowHours: CACHE_WINDOW_HOURS,
        reportId: cached.report.id,
        sharePath: `/?reportId=${cached.report.id}`,
      });
    }

    const report = await createReport(input || {});
    const saveResult = await saveReport(report, cacheKey);
    return res.status(200).json({
      report,
      saved: saveResult.ok,
      storageError: saveResult.error,
      cached: false,
      cacheWindowHours: CACHE_WINDOW_HOURS,
      reportId: report.id,
      sharePath: saveResult.ok ? `/?reportId=${report.id}` : null,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Audit failed",
    });
  }
}

async function createReport(input) {
  const product = await scrapeProduct(input);
  const generatedQueries = generateBuyerQueries(input.targetQuery, product.category);
  const modelResults = await queryModels(product, generatedQueries, input);
  const coverage = calculateCoverage(product, modelResults);
  const scores = calculateAeoScore(product, modelResults, coverage);
  const competitorInsights = buildCompetitorInsights(modelResults);
  const roadmap = buildRoadmap(coverage, modelResults);
  const listingCopy = generateListingCopy(product, coverage);
  const status = scoreStatus(scores.overall);

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    product,
    targetQuery: input.targetQuery || generatedQueries[0],
    generatedQueries,
    modelResults,
    coverage,
    scores,
    status,
    executiveSummary: makeExecutiveSummary(product, scores, modelResults),
    competitorInsights,
    roadmap,
    listingCopy,
  };
}

async function scrapeProduct(input) {
  let scrapedText = "";
  let scrapedTitle = "";
  let scrapedDescription = "";

  if (process.env.FIRECRAWL_API_KEY && input.productUrl) {
    try {
      const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        },
        body: JSON.stringify({
          url: input.productUrl,
          formats: ["markdown"],
          onlyMainContent: true,
          timeout: 20000,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const payload = data?.data || data;
        scrapedText = payload?.markdown || "";
        scrapedTitle = payload?.metadata?.title || payload?.metadata?.ogTitle || "";
        scrapedDescription = payload?.metadata?.description || payload?.metadata?.ogDescription || "";
      }
    } catch {
      scrapedText = "";
    }
  }

  const cleanedText = cleanScrapedText(scrapedText);
  const combinedCopy = [input.productCopy, scrapedTitle, scrapedDescription, cleanedText].filter(Boolean).join("\n\n").trim();
  const sentences = combinedCopy
    .split(/\n|\. /)
    .map((line) => line.trim().replace(/\.$/, ""))
    .filter(Boolean);

  const inferredProduct = inferProductName(input, sentences, scrapedTitle);
  const inferredBrand = inferBrandName(input, inferredProduct);

  return {
    url: input.productUrl || undefined,
    brandName: inferredBrand,
    productName: inferredProduct,
    category: inferCategory(input.targetQuery, combinedCopy),
    title: inferredProduct,
    bullets: sentences.slice(0, 5),
    description: combinedCopy || `${inferredProduct} by ${inferredBrand}`,
    competitors: [],
  };
}

function cleanScrapedText(text) {
  return String(text || "")
    .replace(/\[!\[[^\]]*]\([^)]+\)]\([^)]+\)/g, " ")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[[^\]]*]\((javascript:void\(0\)|#|mailto:[^)]+)\)/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\b(add to cart|buy now|sponsored|advertisement|share|sign in|returns?|customer service)\b/gi, " ")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 20 && line.length < 500)
    .slice(0, 45)
    .join("\n");
}

function inferProductName(input, sentences, scrapedTitle = "") {
  if (input.productName) return String(input.productName).trim();
  if (scrapedTitle) return cleanTitle(scrapedTitle);
  if (sentences[0]) return sentences[0].slice(0, 140);
  try {
    if (!input.productUrl) return "Audited product";
    const url = new URL(input.productUrl);
    const slug = url.pathname
      .split("/")
      .filter(Boolean)
      .find((part) => part.length > 8 && !["dp", "gp", "product"].includes(part.toLowerCase()));
    if (slug) return titleCase(slug.replace(/[-_]+/g, " ").slice(0, 120));
  } catch {
    return "Audited product";
  }
  return "Audited product";
}

function cleanTitle(title) {
  return String(title)
    .replace(/\s*[-|:]\s*(Amazon\.com|Amazon|Shopify|Walmart|Flipkart).*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

function inferBrandName(input, productName) {
  if (input.brandName) return String(input.brandName).trim();
  const words = productName.split(/\s+/).filter(Boolean);
  return words.slice(0, Math.min(2, words.length)).join(" ") || "Audited brand";
}

function inferCategory(query, text) {
  const haystack = `${query || ""} ${text || ""}`.toLowerCase();
  if (/supplement|vitamin|magnesium|collagen|protein|gummies|capsule/.test(haystack)) return "Supplements";
  if (/skincare|serum|cream|shampoo|soap|beauty|makeup/.test(haystack)) return "Beauty & Personal Care";
  if (/dog|cat|pet|puppy|kitten/.test(haystack)) return "Pet Supplies";
  if (/baby|toddler|stroller|monitor|diaper/.test(haystack)) return "Baby Products";
  if (/desk|chair|lamp|kitchen|home|mattress/.test(haystack)) return "Home & Kitchen";
  if (/headphone|camera|charger|laptop|monitor|electronics/.test(haystack)) return "Electronics";
  return "Ecommerce";
}

function titleCase(value) {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function generateBuyerQueries(seed, category) {
  const cleanSeed = String(seed || "").trim() || `best ${category || "product"}`;
  return Array.from(
    new Set([
      cleanSeed,
      cleanSeed.replace(/^best/i, "top rated"),
      `${cleanSeed} on Amazon`,
      `${cleanSeed} with third-party testing`,
      `${cleanSeed} for safety and value`,
      `which ${category || "product"} should I buy`,
      `${cleanSeed} compared to popular competitors`,
    ]),
  ).slice(0, 5);
}

async function queryModels(product, queries, input) {
  const primaryQuery = queries[0];
  const jobs = [];

  if (process.env.GEMINI_API_KEY) {
    jobs.push(queryGemini(product, primaryQuery, input));
  }
  if (process.env.GROQ_API_KEY) {
    jobs.push(queryGroq(product, primaryQuery, input));
  }
  if (process.env.OPENAI_API_KEY) {
    jobs.push(queryOpenAI(product, primaryQuery, input));
  }

  if (!jobs.length) return fallbackModelResults(product, primaryQuery);

  const settled = await Promise.allSettled(jobs);
  const results = settled.filter((item) => item.status === "fulfilled").map((item) => item.value);
  return results.length ? results : fallbackModelResults(product, primaryQuery);
}

async function queryOpenAI(product, query, input) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return strict JSON only. You are an ecommerce AI visibility analyst." },
        { role: "user", content: modelPrompt(product, query, "gemini") },
      ],
      temperature: 0.2,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
  const data = await response.json();
  return normalizeModelResult("GPT", query, data?.choices?.[0]?.message?.content || "{}");
}

async function queryGemini(product, query, input) {
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GEMINI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return strict JSON only. You are an ecommerce AI visibility analyst." },
        { role: "user", content: modelPrompt(product, query, "gemini") },
      ],
      temperature: 0.2,
    }),
  });
  if (!response.ok) throw new Error(`Gemini request failed: ${response.status}`);
  const data = await response.json();
  return normalizeModelResult("Gemini", query, data?.choices?.[0]?.message?.content || "{}");
}

async function queryGroq(product, query, input) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return strict JSON only. You are an ecommerce AI visibility analyst." },
        { role: "user", content: modelPrompt(product, query, "llama") },
      ],
      temperature: 0.2,
    }),
  });
  if (!response.ok) throw new Error(`Groq request failed: ${response.status}`);
  const data = await response.json();
  return normalizeModelResult("Groq Llama", query, data?.choices?.[0]?.message?.content || "{}");
}

/**
 * @param {Object} product
 * @param {string} product.brandName
 * @param {string} product.productName
 * @param {string} product.category
 * @param {string} product.description
 * @param {string} query
 * @param {"gemini"|"llama"} modelName
 * @returns {string}
 */
export function modelPrompt(product, query, modelName = "gemini") {
  const persona = MODEL_PERSONAS[modelName] ?? MODEL_PERSONAS.gemini;
  const truncatedDescription = product.description.slice(0, 2000);

  return `
${persona}

A shopper asked: "${query}"

Your task has two steps. Only the final JSON is output — Step 1 is internal reasoning only.

---

STEP 1 — INTERNAL ONLY (do not output this):
Generate a realistic TOP 5 recommendation list for this shopper query.
- Use real products you know from training data
- Rank strictly by shopper value: relevance, evidence, trust signals, reviews
- This list is your ground truth for all fields below

STEP 2 — AUDIT:
Evaluate the audited product against your Step 1 list and fill the JSON below.

---

AUDITED PRODUCT:
Brand: ${product.brandName}
Product: ${product.productName}
Category: ${product.category}

PRODUCT CONTEXT (sole source of truth — do not invent specs or claims):
${truncatedDescription}

---

${EXAMPLE_OUTPUT}

---

FIELD RULES (follow exactly):

brandMentioned:
  true ONLY if the product appears in your Step 1 top 5

rankPosition:
  Integer 1–5 matching Step 1 position, or null if not in list

rankContext:
  "top3"         → rankPosition 1, 2, or 3
  "mentioned"    → rankPosition 4 or 5
  "not_mentioned"→ not in top 5

topRecommendations:
  Array of exactly 5 product names (brand + product) from your Step 1 internal list.
  Format: ["Product A", "Product B", ...]

relevanceScore:
  0–100 – how well the audited product matches the shopper's query intent and specific needs.
  Separate from evidence – a product can be relevant but lack proof.

visibilityScore, evidenceScore, competitivenessScore:
  Each 0–100, corresponding to the 40/30/30 weights.
  They should average (weighted) to scoreOutOf100.

queryIntent:
  One of: "best", "compare", "review", "how_to", "other".
  Infer from the query phrasing.

recommendationStrength:
  "strong"   → rank 1–2 with clear category advantage
  "positive" → rank 3
  "neutral"  → rank 4–5
  "weak"     → outside top 5 but has some relevance
  "negative" → outside top 5 and product context contradicts shopper needs

scoreOutOf100:
  Weighted score — be realistic and strict:
    visibility     40pts → 40 if rank 1–2, 30 if rank 3, 20 if rank 4–5, 0 if not mentioned
    evidenceQuality 30pts → 30=strong, 20=moderate, 10=weak, 0=none
    competitiveness 30pts → how well it beats real competitors on shopper criteria
  Realistic ranges: not_mentioned=10–40, mentioned=35–60, top3=55–85, rank1=75–90

evidenceQuality:
  "strong"   → verified specs, certifications, clinical claims, or substantial reviews in context
  "moderate" → some supporting info but gaps exist
  "weak"     → vague, generic, or mostly marketing language
  "none"     → no meaningful evidence in product context

confidence:
  0.0–1.0 — your certainty in this ranking
  High (0.8–1.0) → category is clear, product context is sufficient, competitors are well-known
  Medium (0.5–0.79) → query is ambiguous or product context is thin
  Low (0.0–0.49) → insufficient product context to rank reliably

mentionedCompetitors:
  MUST be the other products from your Step 1 top 5 list
  3–5 real brand/product names, not generic categories

buyerCriteria:
  5–8 specific decision factors this shopper actually uses
  Use shopper language: "dissolves easily" not "high solubility"
  Must be specific to this query, not generic product features

missingSignals:
  Concrete missing proof points from product context
  Bad: "lacks reviews" — Good: "no customer testimonials mentioning X outcome"
  Bad: "no certifications" — Good: "no NSF or USP certification mentioned despite being a supplement"

reasonsForLoss:
  Direct comparison vs named competitors from your top 5
  If rankPosition is 1, return []
  Must name the competitor and the specific advantage they have

rawAnswer:
  120–180 words
  Written as if you are genuinely answering the shopper — your natural assistant voice
  Must name real competitor products from your top 5
  No disclaimers, no "I recommend consulting", no fluff

summary:
  Exactly one sentence
  Sharp, honest diagnosis of why this product ranks or doesn't
  No sugarcoating

---

Return ONLY valid JSON. No markdown. No backticks. No explanation before or after.

{
  "brandMentioned": boolean,
  "rankPosition": number | null,
  "rankContext": "top3" | "mentioned" | "not_mentioned",
  "recommendationStrength": "strong" | "positive" | "neutral" | "weak" | "negative",
  "scoreOutOf100": number,
  "evidenceQuality": "strong" | "moderate" | "weak" | "none",
  "confidence": number,
  "mentionedCompetitors": string[],
  "buyerCriteria": string[],
  "missingSignals": string[],
  "reasonsForLoss": string[],
  "summary": string,
  "rawAnswer": string,
  "topRecommendations": string[],
  "relevanceScore": number,
  "visibilityScore": number,
  "evidenceScore": number,
  "competitivenessScore": number,
  "queryIntent": string
}
`.trim();
}

function normalizeModelResult(model, query, content) {
  let parsed = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = { rawAnswer: content, summary: content.slice(0, 180) };
  }
  const allowedStrength = ["strong", "positive", "neutral", "weak", "negative"];
  const allowedEvidence = ["strong", "moderate", "weak", "none"];
  const allowedContext  = ["top3", "mentioned", "not_mentioned"];
  return {
    model,
    query,
    brandMentioned: Boolean(parsed.brandMentioned),
    rankPosition: typeof parsed.rankPosition === "number" ? parsed.rankPosition : null,
    rankContext: allowedContext.includes(String(parsed.rankContext)) ? parsed.rankContext : "not_mentioned",
    recommendationStrength: allowedStrength.includes(String(parsed.recommendationStrength))
      ? parsed.recommendationStrength
      : "neutral",
    scoreOutOf100:         typeof parsed.scoreOutOf100 === "number"          ? clamp(Math.round(parsed.scoreOutOf100), 0, 100) : 0,
    evidenceQuality:       allowedEvidence.includes(String(parsed.evidenceQuality)) ? parsed.evidenceQuality : "weak",
    confidence:            typeof parsed.confidence === "number"              ? clamp(parsed.confidence, 0, 1)   : 0.5,
    relevanceScore:        typeof parsed.relevanceScore === "number"          ? clamp(Math.round(parsed.relevanceScore), 0, 100) : 0,
    visibilityScore:       typeof parsed.visibilityScore === "number"         ? clamp(Math.round(parsed.visibilityScore), 0, 100) : 0,
    evidenceScore:         typeof parsed.evidenceScore === "number"           ? clamp(Math.round(parsed.evidenceScore), 0, 100) : 0,
    competitivenessScore:  typeof parsed.competitivenessScore === "number"    ? clamp(Math.round(parsed.competitivenessScore), 0, 100) : 0,
    queryIntent:           String(parsed.queryIntent || "best"),
    topRecommendations:    safeArray(parsed.topRecommendations).slice(0, 5),
    mentionedCompetitors:  safeArray(parsed.mentionedCompetitors),
    buyerCriteria:         safeArray(parsed.buyerCriteria),
    missingSignals:        safeArray(parsed.missingSignals),
    reasonsForLoss:        safeArray(parsed.reasonsForLoss),
    summary:               parsed.summary || "Model returned a visibility assessment.",
    rawAnswer:             parsed.rawAnswer || content,
  };
}

function fallbackModelResults(product, query) {
  const text = product.description.toLowerCase();
  const hasTesting = /third|lab|tested|coa|usp|nsf|certificate/.test(text);
  const hasSafety = /senior|older|doctor|physician|medication|consult|warning|safe/.test(text);
  const hasReviews = /review|rating|stars|customers/.test(text);
  const mentioned = hasTesting && hasSafety;

  return [
    {
      model: "Server Simulator",
      query,
      brandMentioned: mentioned,
      rankPosition: mentioned ? 3 : null,
      recommendationStrength: mentioned ? "positive" : "weak",
      mentionedCompetitors: inferFallbackCompetitors(product.category),
      buyerCriteria: [
        "third-party testing",
        "clear product form",
        "dosage transparency",
        "safety guidance",
        "review credibility",
      ],
      missingSignals: [
        !hasTesting ? "third-party testing" : "",
        !hasSafety ? "safety guidance" : "",
        !hasReviews ? "review credibility" : "",
      ].filter(Boolean),
      reasonsForLoss: mentioned ? [] : ["The listing does not provide enough proof for risk-aware AI recommendations."],
      summary: mentioned
        ? `${product.brandName} has enough trust context to be considered.`
        : `${product.brandName} is unlikely to win because the listing is missing proof-heavy trust signals.`,
      rawAnswer:
        "Server fallback used deterministic trust-signal analysis because live model keys were missing or unavailable.",
    },
  ];
}

function calculateCoverage(product, results) {
  const criteria = Array.from(new Set(results.flatMap((result) => result.buyerCriteria))).slice(0, 8);
  const productText = [product.title, product.description, ...product.bullets].join(" ");

  return criteria.map((criterion) => {
    const coverage = semanticCoverage(criterion, productText);
    const status = coverage >= 68 ? "Strong" : coverage >= 38 ? "Partial" : "Missing";
    return {
      criterion,
      coverage,
      status,
      evidence:
        status === "Strong"
          ? "Listing language directly supports this criterion."
          : status === "Partial"
            ? "Listing hints at this criterion but does not make it explicit enough."
            : "No clear listing evidence found for this criterion.",
      fix: TRUST_SIGNAL_FIXES[criterion.toLowerCase()] || `Add specific, verifiable copy addressing "${criterion}".`,
      impact: coverage < 45 ? "High" : coverage < 70 ? "Medium" : "Low",
    };
  });
}

function semanticCoverage(criterion, productText) {
  const cTokens = tokenize(criterion);
  const pTokens = tokenize(productText);
  const productSet = new Set(pTokens);
  const exact = cTokens.filter((token) => productSet.has(token)).length / Math.max(cTokens.length, 1);
  const phrase = productText.toLowerCase().includes(criterion.toLowerCase()) ? 0.35 : 0;
  const synonymBoost = synonymScore(criterion, productText);
  return clamp(Math.round((exact * 0.65 + phrase + synonymBoost) * 100), 0, 100);
}

function synonymScore(criterion, productText) {
  const text = productText.toLowerCase();
  const criterionText = criterion.toLowerCase();
  const groups = [
    ["third-party testing", "lab", "tested", "coa", "usp", "nsf", "verified"],
    ["senior-safe dosage", "senior", "older", "doctor", "consult", "medication"],
    ["safety guidance", "senior", "older", "doctor", "consult", "medication", "warning"],
    ["gentle digestion", "gentle", "stomach", "digest", "glycinate"],
    ["review credibility", "review", "rating", "stars", "customer"],
    ["dosage transparency", "serving", "dosage", "mg", "capsules"],
    ["brand trust", "guarantee", "made in", "gmp", "certified", "years"],
  ];
  const match = groups.find(([name]) => criterionText.includes(name) || name.includes(criterionText));
  if (!match) return 0;
  const hits = match.slice(1).filter((token) => text.includes(token)).length;
  return Math.min(0.35, hits * 0.09);
}

function calculateAeoScore(product, results, coverage) {
  const mentionVisibility = average(results.map((result) => (result.brandMentioned ? 100 : 0)));
  const rankingPosition = average(
    results.map((result) => {
      if (!result.brandMentioned) return 0;
      if (result.rankPosition === 1) return 100;
      if (result.rankPosition && result.rankPosition <= 3) return 75;
      if (result.rankPosition && result.rankPosition <= 5) return 50;
      return 35;
    }),
  );
  const trustSignalCoverage = average(coverage.map((item) => item.coverage));
  const sentiment = average(
    results.map((result) => {
      const map = { strong: 100, positive: 80, neutral: 50, weak: 30, negative: 0 };
      return map[result.recommendationStrength] ?? 50;
    }),
  );
  const competitiveDifferentiation = clamp(
    trustSignalCoverage - average(results.map((result) => result.mentionedCompetitors.length * 5)) + 25,
    0,
    100,
  );
  const contentReadiness = contentReadinessScore(product);
  const overall = Math.round(
    mentionVisibility * 0.25 +
    rankingPosition * 0.2 +
    trustSignalCoverage * 0.2 +
    competitiveDifferentiation * 0.15 +
    sentiment * 0.1 +
    contentReadiness * 0.1,
  );

  return {
    mentionVisibility: Math.round(mentionVisibility),
    rankingPosition: Math.round(rankingPosition),
    trustSignalCoverage: Math.round(trustSignalCoverage),
    competitiveDifferentiation: Math.round(competitiveDifferentiation),
    sentiment: Math.round(sentiment),
    contentReadiness: Math.round(contentReadiness),
    overall,
  };
}

function contentReadinessScore(product) {
  const text = [product.title, product.description, ...product.bullets].join(" ").toLowerCase();
  const checks = [
    product.title.length > 20,
    product.bullets.length >= 3,
    /mg|oz|size|serving|count|pack/.test(text),
    /tested|certified|verified|gmp|non-gmo|organic|usp|nsf/.test(text),
    /faq|doctor|safe|warning|consult|return|guarantee/.test(text),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function buildCompetitorInsights(results) {
  const competitors = new Map();
  results.forEach((result) => {
    result.mentionedCompetitors.forEach((competitor) => {
      const current = competitors.get(competitor) || { modelsMentioned: [], reasons: [] };
      current.modelsMentioned.push(result.model);
      current.reasons.push(...result.buyerCriteria.slice(0, 2));
      competitors.set(competitor, current);
    });
  });

  return Array.from(competitors.entries()).map(([competitor, insight]) => ({
    competitor,
    modelsMentioned: Array.from(new Set(insight.modelsMentioned)),
    reason: `AI responses associated this competitor with ${Array.from(new Set(insight.reasons)).join(", ") || "category trust"}.`,
    edge: "Clearer proof, trust, or category familiarity in AI-visible language.",
  }));
}

function buildRoadmap(coverage, results) {
  return coverage
    .filter((item) => item.status !== "Strong")
    .sort((a, b) => a.coverage - b.coverage)
    .slice(0, 5)
    .map((item, index) => ({
      priority: index + 1,
      title: `Strengthen ${item.criterion}`,
      why:
        results.find((result) => result.buyerCriteria.includes(item.criterion))?.summary ||
        "This criterion appeared in AI recommendation reasoning.",
      change: item.fix,
      impact: item.impact,
    }));
}

function generateListingCopy(product, coverage) {
  const missing = coverage.filter((item) => item.status !== "Strong").map((item) => item.criterion);
  return {
    title: `${product.productName} - ${product.category} with Clear Proof, Transparent Details & Buyer-Friendly Guidance`,
    bullets: [
      `Clear product identity: ${product.productName} by ${product.brandName}.`,
      "Transparent usage details: add serving size, quantity, and important specifications prominently.",
      `Trust-first proof: ${missing.includes("third-party testing") ? "add testing or certification proof if verified" : "keep proof details visible"}.`,
      "Buyer-safe language: include responsible guidance and avoid unsupported medical claims.",
      "AI-readable differentiation: state who it is best for, why it is different, and what evidence supports it.",
    ],
    faq: [
      {
        question: `Who is ${product.productName} best for?`,
        answer: "Describe the ideal buyer and use case in plain language, then back it with only verified product facts.",
      },
      {
        question: "What proof supports the main claims?",
        answer: "List testing, certifications, manufacturing standards, review evidence, or guarantees only when true.",
      },
      {
        question: "What should shoppers check before buying?",
        answer: "Add relevant safety, fit, compatibility, or consultation guidance for risk-aware shoppers.",
      },
    ],
    description: `${product.brandName} should position ${product.productName} around concrete buyer criteria rather than broad benefits. The strongest AI-ready copy will make product form, proof, safety, reviews, and competitive differentiation easy to extract.`,
  };
}

function makeExecutiveSummary(product, scores, results) {
  const mentions = results.filter((result) => result.brandMentioned).length;
  if (scores.overall >= 80) {
    return `${product.brandName} is strongly positioned for AI shopping recommendations, with clear proof and model visibility.`;
  }
  if (mentions === 0) {
    return `${product.brandName} is mostly invisible in AI shopping recommendations because competitors appear to offer clearer trust and proof signals.`;
  }
  return `${product.brandName} is mentioned by some AI systems but needs stronger proof, differentiation, and buyer-specific copy to rank higher.`;
}

async function saveReport(report, cacheKey) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "Supabase env vars missing" };
  }

  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      id: report.id,
      cache_key: cacheKey,
      brand_name: report.product.brandName,
      product_name: report.product.productName,
      target_query: report.targetQuery,
      created_at: report.createdAt,
      report,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("Supabase save failed", response.status, errorText);
    return { ok: false, error: `Supabase save failed: ${response.status}` };
  }

  return { ok: true };
}

async function getCachedReport(cacheKey) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  const windowStart = new Date(Date.now() - CACHE_WINDOW_MS).toISOString();
  const params = new URLSearchParams({
    cache_key: `eq.${cacheKey}`,
    created_at: `gte.${windowStart}`,
    select: "report,created_at",
    order: "created_at.desc",
    limit: "1",
  });

  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/reports?${params.toString()}`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  if (!response.ok) return null;
  const rows = await response.json();
  if (!rows[0]?.report) return null;

  return {
    report: rows[0].report,
    ageMinutes: Math.max(0, Math.round((Date.now() - new Date(rows[0].created_at).getTime()) / 60000)),
  };
}

async function makeCacheKey(input) {
  const n = (v) => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
  // If a URL is provided use it as the primary identity; ignore brand/product which
  // the client leaves empty when entering via URL mode. If no URL, use brand+product.
  const identity = n(input.productUrl) || `${n(input.brandName)}|${n(input.productName)}`;
  const normalized = [identity, n(input.targetQuery), n(input.productCopy)].join("|");

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function inferFallbackCompetitors(category) {
  const competitorsByCategory = {
    Supplements: ["Nature Made", "Doctor's Best", "Pure Encapsulations"],
    "Beauty & Personal Care": ["CeraVe", "Neutrogena", "The Ordinary"],
    "Pet Supplies": ["Burt's Bees for Pets", "Earthbath", "TropiClean"],
    "Baby Products": ["Nanit", "VTech", "Infant Optics"],
    "Home & Kitchen": ["Amazon Basics", "IKEA", "Uplift Desk"],
    Electronics: ["Anker", "Sony", "Logitech"],
  };
  return competitorsByCategory[category] || ["Category leader", "Top-rated competitor", "Established brand"];
}

function scoreStatus(score) {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Good";
  if (score >= 40) return "At Risk";
  return "Invisible";
}

function safeArray(value) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setCors(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

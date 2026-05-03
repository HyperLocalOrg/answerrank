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
    const saved = await saveReport(report, cacheKey);
    return res.status(200).json({
      report,
      saved: Boolean(saved),
      cached: false,
      cacheWindowHours: CACHE_WINDOW_HOURS,
      reportId: report.id,
      sharePath: saved ? `/?reportId=${report.id}` : null,
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
  const generatedQueries = generateBuyerQueries(input.targetQuery, input.category);
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
  const competitors = String(input.competitors || "")
    .split(/,|\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  let scrapedText = "";

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
        scrapedText = data?.data?.markdown || data?.markdown || "";
      }
    } catch {
      scrapedText = "";
    }
  }

  const combinedCopy = [input.productCopy, scrapedText].filter(Boolean).join("\n\n").trim();
  const sentences = combinedCopy
    .split(/\n|\. /)
    .map((line) => line.trim().replace(/\.$/, ""))
    .filter(Boolean);

  return {
    url: input.productUrl || undefined,
    brandName: input.brandName || "Unknown brand",
    productName: input.productName || input.brandName || "Unknown product",
    category: input.category || "Ecommerce",
    title: input.productName || sentences[0] || input.brandName || "Unknown product",
    bullets: sentences.slice(0, 5),
    description: combinedCopy || `${input.productName || "Product"} by ${input.brandName || "brand"}`,
    competitors,
  };
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

  if (process.env.OPENAI_API_KEY) {
    jobs.push(queryOpenAI(product, primaryQuery, input));
  }
  if (process.env.GEMINI_API_KEY) {
    jobs.push(queryGemini(product, primaryQuery, input));
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
        { role: "user", content: modelPrompt(product, query, input) },
      ],
      temperature: 0.2,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
  const data = await response.json();
  return normalizeModelResult("GPT", query, data?.choices?.[0]?.message?.content || "{}");
}

async function queryGemini(product, query, input) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || "gemini-1.5-flash"}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${modelPrompt(product, query, input)}\nReturn only valid JSON.` }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    },
  );
  if (!response.ok) throw new Error(`Gemini request failed: ${response.status}`);
  const data = await response.json();
  return normalizeModelResult("Gemini", query, data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
}

function modelPrompt(product, query, input) {
  return `
Analyze whether an AI shopping assistant would recommend the audited product.

Buyer query: ${query}
Audited brand: ${product.brandName}
Audited product: ${product.productName}
Category: ${product.category}
Product context:
${product.description.slice(0, 7000)}
Competitors:
${product.competitors.join(", ") || input.competitors || "unknown"}

Return JSON with:
brandMentioned boolean,
rankPosition number or null,
recommendationStrength one of strong, positive, neutral, weak, negative,
mentionedCompetitors string[],
buyerCriteria string[],
missingSignals string[],
reasonsForLoss string[],
summary string,
rawAnswer string.
`.trim();
}

function normalizeModelResult(model, query, content) {
  let parsed = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = { rawAnswer: content, summary: content.slice(0, 180) };
  }
  const allowed = ["strong", "positive", "neutral", "weak", "negative"];
  return {
    model,
    query,
    brandMentioned: Boolean(parsed.brandMentioned),
    rankPosition: typeof parsed.rankPosition === "number" ? parsed.rankPosition : null,
    recommendationStrength: allowed.includes(String(parsed.recommendationStrength))
      ? parsed.recommendationStrength
      : "neutral",
    mentionedCompetitors: safeArray(parsed.mentionedCompetitors),
    buyerCriteria: safeArray(parsed.buyerCriteria),
    missingSignals: safeArray(parsed.missingSignals),
    reasonsForLoss: safeArray(parsed.reasonsForLoss),
    summary: parsed.summary || "Model returned a visibility assessment.",
    rawAnswer: parsed.rawAnswer || content,
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
      mentionedCompetitors: product.competitors.slice(0, 3),
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
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;

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
      report,
    }),
  });

  return response.ok;
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
  const normalized = [
    input.productUrl,
    input.brandName,
    input.productName,
    input.category,
    input.targetQuery,
    input.competitors,
    input.productCopy,
  ]
    .map((value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
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

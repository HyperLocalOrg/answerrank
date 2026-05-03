import { sampleReport } from "../data/sample";
import type {
  AuditInput,
  AuditReport,
  CoverageItem,
  ModelResult,
  ProductContext,
  ScoreBreakdown,
} from "../types";

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

const TRUST_SIGNAL_FIXES: Record<string, string> = {
  "third-party testing": "Add lab-tested, COA, USP, NSF, or independent testing proof if verified.",
  "clear magnesium form": "Keep the exact magnesium form in the title, first bullet, and FAQ.",
  "magnesium form clarity": "Keep the exact magnesium form in the title, first bullet, and FAQ.",
  "senior-safe dosage": "Add older-adult dosage guidance and a healthcare-professional disclaimer.",
  "gentle digestion": "Explain digestive tolerance in plain buyer language if supportable.",
  "review credibility": "Surface review themes that prove the claimed benefit.",
  "dosage transparency": "Show serving size, elemental magnesium amount, and capsules per serving clearly.",
  "brand trust": "Add trust proof: testing, manufacturing standards, founder story, or guarantee.",
  "safety warnings": "Add responsible safety and medication-interaction guidance.",
};

export async function runAudit(input: AuditInput): Promise<AuditReport> {
  if (!input.liveMode) {
    await wait(900);
    return {
      ...sampleReport,
      id: crypto.randomUUID(),
      cacheStatus: "demo",
      createdAt: new Date().toISOString(),
    };
  }

  const apiReport = await runBackendAudit(input);
  if (apiReport) return apiReport;

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
    targetQuery: input.targetQuery,
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

async function runBackendAudit(input: AuditInput): Promise<AuditReport | null> {
  const response = await fetch("/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error("Live audit API failed. Use demo mode locally, or run with Vercel/Supabase env vars.");
  }

  const data = await response.json();
  return data.report
    ? {
        ...data.report,
        saved: Boolean(data.saved),
        cached: Boolean(data.cached),
        storageError: data.storageError,
        cacheStatus: data.cached ? "hit" : "miss",
        cacheAgeMinutes: data.cacheAgeMinutes,
        cacheWindowHours: data.cacheWindowHours,
      }
    : null;
}

async function scrapeProduct(input: AuditInput): Promise<ProductContext> {
  let scrapedText = "";
  const firecrawlKey = import.meta.env.VITE_FIRECRAWL_API_KEY as string | undefined;

  if (firecrawlKey && input.productUrl) {
    try {
      const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firecrawlKey}`,
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

  const combinedCopy = [input.productCopy || "", scrapedText].filter(Boolean).join("\n\n").trim();
  const sentences = combinedCopy
    .split(/\n|\. /)
    .map((line) => line.trim().replace(/\.$/, ""))
    .filter(Boolean);

  const inferredProduct = inferProductName(input, sentences);
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

function inferProductName(input: AuditInput, sentences: string[]): string {
  if (input.productName) return input.productName.trim();
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

function inferBrandName(input: AuditInput, productName: string): string {
  if (input.brandName) return input.brandName.trim();
  const words = productName.split(/\s+/).filter(Boolean);
  return words.slice(0, Math.min(2, words.length)).join(" ") || "Audited brand";
}

function inferCategory(query: string, text: string): string {
  const haystack = `${query || ""} ${text || ""}`.toLowerCase();
  if (/supplement|vitamin|magnesium|collagen|protein|gummies|capsule/.test(haystack)) return "Supplements";
  if (/skincare|serum|cream|shampoo|soap|beauty|makeup/.test(haystack)) return "Beauty & Personal Care";
  if (/dog|cat|pet|puppy|kitten/.test(haystack)) return "Pet Supplies";
  if (/baby|toddler|stroller|monitor|diaper/.test(haystack)) return "Baby Products";
  if (/desk|chair|lamp|kitchen|home|mattress/.test(haystack)) return "Home & Kitchen";
  if (/headphone|camera|charger|laptop|monitor|electronics/.test(haystack)) return "Electronics";
  return "Ecommerce";
}

function titleCase(value: string): string {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function generateBuyerQueries(seed: string, category: string): string[] {
  const cleanSeed = seed.trim() || `best ${category || "product"}`;
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
  ).slice(0, 7);
}

async function queryModels(product: ProductContext, queries: string[], input: AuditInput): Promise<ModelResult[]> {
  const primaryQuery = queries[0];
  const jobs: Promise<ModelResult>[] = [];
  const openAiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  if (openAiKey) {
    jobs.push(queryOpenAI(product, primaryQuery, input, openAiKey));
  }
  if (geminiKey) {
    jobs.push(queryGemini(product, primaryQuery, input, geminiKey));
  }

  if (jobs.length === 0) {
    return fallbackModelResults(product, primaryQuery);
  }

  const settled = await Promise.allSettled(jobs);
  const results = settled
    .filter((item): item is PromiseFulfilledResult<ModelResult> => item.status === "fulfilled")
    .map((item) => item.value);

  return results.length ? results : fallbackModelResults(product, primaryQuery);
}

async function queryOpenAI(
  product: ProductContext,
  query: string,
  input: AuditInput,
  apiKey: string,
): Promise<ModelResult> {
  const prompt = modelPrompt(product, query, input);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return strict JSON only. You are an ecommerce AI visibility analyst." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });
  if (!response.ok) throw new Error("OpenAI request failed");
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || "{}";
  return normalizeModelResult("GPT", query, content);
}

async function queryGemini(
  product: ProductContext,
  query: string,
  input: AuditInput,
  apiKey: string,
): Promise<ModelResult> {
  const prompt = `${modelPrompt(product, query, input)}\nReturn only valid JSON.`;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    },
  );
  if (!response.ok) throw new Error("Gemini request failed");
  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return normalizeModelResult("Gemini", query, content);
}

function modelPrompt(product: ProductContext, query: string, input: AuditInput): string {
  return `
Analyze whether an AI shopping assistant would recommend the audited product.

Buyer query: ${query}
Audited brand: ${product.brandName}
Audited product: ${product.productName}
Category: ${product.category}
Product context:
${product.description}
Competitors:
Infer likely competitors from the buyer query, category, and your shopping knowledge. Do not require user-provided competitors.

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

function normalizeModelResult(model: string, query: string, content: string): ModelResult {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = { rawAnswer: content, summary: content.slice(0, 180) };
  }

  const allowedStrength = ["strong", "positive", "neutral", "weak", "negative"];
  const allowedEvidence = ["strong", "moderate", "weak", "none"];
  const allowedContext  = ["top3", "mentioned", "not_mentioned"];

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  return {
    model,
    query,
    brandMentioned: Boolean(parsed.brandMentioned),
    rankPosition: typeof parsed.rankPosition === "number" ? parsed.rankPosition : null,
    rankContext: allowedContext.includes(String(parsed.rankContext))
      ? (parsed.rankContext as ModelResult["rankContext"])
      : "not_mentioned",
    recommendationStrength: allowedStrength.includes(String(parsed.recommendationStrength))
      ? (parsed.recommendationStrength as ModelResult["recommendationStrength"])
      : "neutral",
    scoreOutOf100: typeof parsed.scoreOutOf100 === "number"
      ? clamp(Math.round(parsed.scoreOutOf100), 0, 100) : 0,
    evidenceQuality: allowedEvidence.includes(String(parsed.evidenceQuality))
      ? (parsed.evidenceQuality as ModelResult["evidenceQuality"])
      : "weak",
    confidence: typeof parsed.confidence === "number" ? clamp(parsed.confidence, 0, 1) : 0.5,
    relevanceScore: typeof parsed.relevanceScore === "number"
      ? clamp(Math.round(parsed.relevanceScore), 0, 100) : 0,
    visibilityScore: typeof parsed.visibilityScore === "number"
      ? clamp(Math.round(parsed.visibilityScore), 0, 100) : 0,
    evidenceScore: typeof parsed.evidenceScore === "number"
      ? clamp(Math.round(parsed.evidenceScore), 0, 100) : 0,
    competitivenessScore: typeof parsed.competitivenessScore === "number"
      ? clamp(Math.round(parsed.competitivenessScore), 0, 100) : 0,
    queryIntent: String(parsed.queryIntent || "best"),
    topRecommendations: safeArray(parsed.topRecommendations as unknown[]).slice(0, 5),
    mentionedCompetitors: safeArray(parsed.mentionedCompetitors as unknown[]),
    buyerCriteria: safeArray(parsed.buyerCriteria as unknown[]),
    missingSignals: safeArray(parsed.missingSignals as unknown[]),
    reasonsForLoss: safeArray(parsed.reasonsForLoss as unknown[]),
    summary: typeof parsed.summary === "string" ? parsed.summary : "Model returned a visibility assessment.",
    rawAnswer: typeof parsed.rawAnswer === "string" ? parsed.rawAnswer : content,
  };
}

function fallbackModelResults(product: ProductContext, query: string): ModelResult[] {
  const text = product.description.toLowerCase();
  const hasTesting = /third|lab|tested|coa|usp|nsf|certificate/.test(text);
  const hasSafety = /senior|older|doctor|physician|medication|consult|warning|safe/.test(text);
  const hasReviews = /review|rating|stars|customers/.test(text);
  const mentioned = hasTesting && hasSafety;

  return [
    {
      model: "Demo AI Search Simulator",
      query,
      brandMentioned: mentioned,
      rankPosition: mentioned ? 3 : null,
      rankContext: mentioned ? "mentioned" : "not_mentioned",
      recommendationStrength: mentioned ? "positive" : "weak",
      scoreOutOf100: mentioned ? 42 : 18,
      evidenceQuality: hasTesting ? "moderate" : "weak",
      confidence: 0.6,
      relevanceScore: 50,
      visibilityScore: mentioned ? 20 : 0,
      evidenceScore: hasTesting ? 40 : 15,
      competitivenessScore: 25,
      queryIntent: "best",
      topRecommendations: inferFallbackCompetitors(product.category),
      mentionedCompetitors: inferFallbackCompetitors(product.category),
      buyerCriteria: [
        "third-party testing",
        "clear product form",
        "dosage transparency",
        "safety guidance",
        "review credibility",
      ],
      missingSignals: [
        !hasTesting ? "No third-party testing certification found in listing" : "",
        !hasSafety ? "No safety or consultation guidance for risk-aware shoppers" : "",
        !hasReviews ? "No review-backed claims or customer outcome language" : "",
      ].filter(Boolean),
      reasonsForLoss: mentioned ? [] : ["The listing does not provide enough proof for risk-aware AI recommendations."],
      summary: mentioned
        ? `${product.brandName} has enough trust context to be considered.`
        : `${product.brandName} is unlikely to win because the listing is missing proof-heavy trust signals.`,
      rawAnswer:
        "This simulator checks the listing for the same kinds of signals AI shopping assistants tend to surface: proof, clarity, safety, differentiation, and review trust.",
    },
  ];
}

function inferFallbackCompetitors(category: string): string[] {
  const competitorsByCategory: Record<string, string[]> = {
    Supplements: ["Nature Made", "Doctor's Best", "Pure Encapsulations"],
    "Beauty & Personal Care": ["CeraVe", "Neutrogena", "The Ordinary"],
    "Pet Supplies": ["Burt's Bees for Pets", "Earthbath", "TropiClean"],
    "Baby Products": ["Nanit", "VTech", "Infant Optics"],
    "Home & Kitchen": ["Amazon Basics", "IKEA", "Uplift Desk"],
    Electronics: ["Anker", "Sony", "Logitech"],
  };
  return competitorsByCategory[category] || ["Category leader", "Top-rated competitor", "Established brand"];
}

function calculateCoverage(product: ProductContext, results: ModelResult[]): CoverageItem[] {
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

function semanticCoverage(criterion: string, productText: string): number {
  const cTokens = tokenize(criterion);
  const pTokens = tokenize(productText);
  const productSet = new Set(pTokens);
  const exact = cTokens.filter((token) => productSet.has(token)).length / Math.max(cTokens.length, 1);
  const phrase = productText.toLowerCase().includes(criterion.toLowerCase()) ? 0.35 : 0;
  const synonymBoost = synonymScore(criterion, productText);
  return clamp(Math.round((exact * 0.65 + phrase + synonymBoost) * 100), 0, 100);
}

function synonymScore(criterion: string, productText: string): number {
  const text = productText.toLowerCase();
  const criterionText = criterion.toLowerCase();
  const groups = [
    ["third-party testing", "lab", "tested", "coa", "usp", "nsf", "verified"],
    ["senior-safe dosage", "senior", "older", "doctor", "consult", "medication"],
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

function calculateAeoScore(product: ProductContext, results: ModelResult[], coverage: CoverageItem[]): ScoreBreakdown {
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
      return map[result.recommendationStrength];
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

function contentReadinessScore(product: ProductContext): number {
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

function buildCompetitorInsights(results: ModelResult[]) {
  const competitors = new Map<string, { modelsMentioned: string[]; reasons: string[] }>();
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

function buildRoadmap(coverage: CoverageItem[], results: ModelResult[]) {
  const missing = coverage
    .filter((item) => item.status !== "Strong")
    .sort((a, b) => a.coverage - b.coverage)
    .slice(0, 5);

  return missing.map((item, index) => ({
    priority: index + 1,
    title: `Strengthen ${item.criterion}`,
    why:
      results.find((result) => result.buyerCriteria.includes(item.criterion))?.summary ||
      "This criterion appeared in AI recommendation reasoning.",
    change: item.fix,
    impact: item.impact,
  }));
}

function generateListingCopy(product: ProductContext, coverage: CoverageItem[]) {
  const missing = coverage.filter((item) => item.status !== "Strong").map((item) => item.criterion);
  return {
    title: `${product.productName} - ${product.category} with Clear Proof, Transparent Details & Buyer-Friendly Guidance`,
    bullets: [
      `Clear product identity: ${product.productName} by ${product.brandName}.`,
      `Transparent usage details: add serving size, quantity, and important specifications prominently.`,
      `Trust-first proof: ${missing.includes("third-party testing") ? "add testing or certification proof if verified" : "keep proof details visible"}.`,
      "Buyer-safe language: include responsible guidance and avoid unsupported medical claims.",
      "AI-readable differentiation: state who it is best for, why it is different, and what evidence supports it.",
    ],
    faq: [
      {
        question: `Who is ${product.productName} best for?`,
        answer:
          "Describe the ideal buyer and use case in plain language, then back it with only verified product facts.",
      },
      {
        question: "What proof supports the main claims?",
        answer: "List testing, certifications, manufacturing standards, review evidence, or guarantees only when true.",
      },
      {
        question: "What should shoppers check before buying?",
        answer:
          "Add relevant safety, fit, compatibility, or consultation guidance for risk-aware shoppers.",
      },
    ],
    description: `${product.brandName} should position ${product.productName} around concrete buyer criteria rather than broad benefits. The strongest AI-ready copy will make product form, proof, safety, reviews, and competitive differentiation easy to extract.`,
  };
}

function makeExecutiveSummary(product: ProductContext, scores: ScoreBreakdown, results: ModelResult[]): string {
  const mentions = results.filter((result) => result.brandMentioned).length;
  if (scores.overall >= 80) {
    return `${product.brandName} is strongly positioned for AI shopping recommendations, with clear proof and model visibility.`;
  }
  if (mentions === 0) {
    return `${product.brandName} is mostly invisible in AI shopping recommendations because competitors appear to offer clearer trust and proof signals.`;
  }
  return `${product.brandName} is mentioned by some AI systems but needs stronger proof, differentiation, and buyer-specific copy to rank higher.`;
}

function scoreStatus(score: number): AuditReport["status"] {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Good";
  if (score >= 40) return "At Risk";
  return "Invisible";
}

function safeArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

import type { AuditInput, AuditReport } from "../types";

export const sampleInput: AuditInput = {
  productUrl: "https://www.amazon.com/example-magnesium-glycinate",
  brandName: "CalmLeaf",
  productName: "CalmLeaf Magnesium Glycinate 200mg",
  category: "Supplements",
  targetQuery: "best magnesium supplement for seniors",
  competitors: "Nature Made, Doctor's Best, Pure Encapsulations, NOW Foods",
  productCopy:
    "CalmLeaf Magnesium Glycinate 200mg supports sleep, muscle relaxation, and daily wellness. Easy-to-swallow capsules. Non-GMO. 120 capsules per bottle. Suggested use: take two capsules daily.",
  liveMode: false,
};

export const sampleReport: AuditReport = {
  id: "demo-magnesium-seniors",
  createdAt: new Date().toISOString(),
  targetQuery: sampleInput.targetQuery,
  product: {
    url: sampleInput.productUrl,
    brandName: "CalmLeaf",
    productName: "CalmLeaf Magnesium Glycinate 200mg",
    category: "Supplements",
    title: "CalmLeaf Magnesium Glycinate 200mg",
    bullets: [
      "Supports sleep and muscle relaxation",
      "Easy-to-swallow capsules",
      "Non-GMO formula",
      "120 capsules per bottle",
    ],
    description:
      "A magnesium glycinate supplement positioned for sleep and daily wellness, but missing clear proof around senior safety, lab testing, and digestive tolerance.",
    rating: "4.2",
    reviewCount: "381",
    competitors: ["Nature Made", "Doctor's Best", "Pure Encapsulations", "NOW Foods"],
  },
  generatedQueries: [
    "best magnesium supplement for seniors",
    "best magnesium glycinate for sleep",
    "magnesium supplement gentle on stomach",
    "safe magnesium for older adults",
    "magnesium glycinate vs citrate for seniors",
    "third party tested magnesium supplement",
  ],
  modelResults: [
    {
      model: "GPT",
      query: "best magnesium supplement for seniors",
      brandMentioned: false,
      rankPosition: null,
      recommendationStrength: "negative",
      mentionedCompetitors: ["Nature Made", "Doctor's Best", "Pure Encapsulations"],
      buyerCriteria: [
        "third-party testing",
        "clear magnesium form",
        "senior-safe dosage",
        "gentle digestion",
        "review credibility",
      ],
      missingSignals: ["third-party testing", "senior-specific dosage guidance", "doctor consultation FAQ"],
      reasonsForLoss: ["Competitors communicate testing and dosage more clearly."],
      summary: "GPT did not recommend CalmLeaf and preferred brands with stronger proof signals.",
      rawAnswer:
        "For seniors, I would look for magnesium glycinate with clear dosage, third-party testing, gentle digestion claims, and strong review history. I would consider Doctor's Best, Nature Made, and Pure Encapsulations before CalmLeaf because CalmLeaf does not show enough testing or senior-specific safety information.",
    },
    {
      model: "Gemini",
      query: "best magnesium supplement for seniors",
      brandMentioned: true,
      rankPosition: 4,
      recommendationStrength: "weak",
      mentionedCompetitors: ["Nature Made", "NOW Foods", "Doctor's Best"],
      buyerCriteria: ["USP or third-party verification", "dosage transparency", "brand trust", "digestive tolerance"],
      missingSignals: ["verification proof", "clear comparison against citrate", "senior use FAQ"],
      reasonsForLoss: ["The listing is benefit-led but not proof-led."],
      summary: "Gemini mentioned CalmLeaf but ranked it behind better-known competitors.",
      rawAnswer:
        "CalmLeaf may be an option if the shopper specifically wants magnesium glycinate, but I would rank established brands higher because they present stronger verification, safety, and dosage information.",
    },
    {
      model: "AI Search Simulator",
      query: "safe magnesium for older adults",
      brandMentioned: false,
      rankPosition: null,
      recommendationStrength: "neutral",
      mentionedCompetitors: ["Pure Encapsulations", "Nature Made"],
      buyerCriteria: ["safety warnings", "medication interaction guidance", "doctor consultation", "low digestive side effects"],
      missingSignals: ["medication interaction note", "senior safety disclaimer", "third-party testing"],
      reasonsForLoss: ["CalmLeaf does not answer the senior safety question directly."],
      summary: "The simulator treated safety and medical context as the deciding factors.",
      rawAnswer:
        "Older adults should prioritize supplements with transparent labels, low digestive side effects, and clear guidance to consult a healthcare professional, especially if taking medications.",
    },
  ],
  coverage: [
    {
      criterion: "Third-party testing",
      coverage: 8,
      status: "Missing",
      evidence: "No lab testing, USP, NSF, COA, or independent verification language found.",
      fix: "Add verified testing proof to the title image stack, bullets, and FAQ if true.",
      impact: "High",
    },
    {
      criterion: "Magnesium form clarity",
      coverage: 86,
      status: "Strong",
      evidence: "The listing clearly says magnesium glycinate.",
      fix: "Keep magnesium glycinate in the title and first bullet.",
      impact: "High",
    },
    {
      criterion: "Senior-safe dosage",
      coverage: 24,
      status: "Missing",
      evidence: "Dosage exists, but not framed for older adults or medication-aware shoppers.",
      fix: "Add a senior use FAQ with dosage clarity and a healthcare-professional disclaimer.",
      impact: "High",
    },
    {
      criterion: "Gentle digestion",
      coverage: 42,
      status: "Partial",
      evidence: "Glycinate implies gentleness, but the listing does not say it directly.",
      fix: "Explain why glycinate is commonly chosen for digestive comfort, only if supportable.",
      impact: "Medium",
    },
    {
      criterion: "Review credibility",
      coverage: 31,
      status: "Partial",
      evidence: "Rating exists, but the listing does not surface review themes.",
      fix: "Add review-backed language around sleep, cramps, capsule size, and tolerance.",
      impact: "Medium",
    },
  ],
  scores: {
    mentionVisibility: 22,
    rankingPosition: 16,
    trustSignalCoverage: 38,
    competitiveDifferentiation: 34,
    sentiment: 28,
    contentReadiness: 52,
    overall: 31,
  },
  status: "Invisible",
  executiveSummary:
    "CalmLeaf is largely invisible for senior magnesium searches because AI assistants prefer brands with clearer testing, dosage, safety, and trust signals.",
  competitorInsights: [
    {
      competitor: "Nature Made",
      modelsMentioned: ["GPT", "Gemini", "AI Search Simulator"],
      reason: "Recognized supplement brand with stronger trust shorthand.",
      edge: "Brand familiarity and verification language.",
    },
    {
      competitor: "Doctor's Best",
      modelsMentioned: ["GPT", "Gemini"],
      reason: "Often associated with magnesium glycinate and clear supplement positioning.",
      edge: "Specific form clarity and shopper familiarity.",
    },
    {
      competitor: "Pure Encapsulations",
      modelsMentioned: ["GPT", "AI Search Simulator"],
      reason: "Premium positioning and clean-label trust perception.",
      edge: "Perceived purity and practitioner-style credibility.",
    },
  ],
  roadmap: [
    {
      priority: 1,
      title: "Make proof visible",
      why: "AI models repeatedly used testing and verification as a recommendation filter.",
      change: "Add third-party tested, COA, USP, NSF, or lab-tested proof wherever true.",
      impact: "High",
    },
    {
      priority: 2,
      title: "Answer the senior safety concern",
      why: "The target query includes seniors, so models look for dosage and medication caution.",
      change: "Add an FAQ covering older adult use, suggested dosage, and doctor consultation.",
      impact: "High",
    },
    {
      priority: 3,
      title: "Translate glycinate into buyer language",
      why: "Models know glycinate matters, but shoppers need the benefit made explicit.",
      change: "Use supportable language around sleep, muscle relaxation, and digestive comfort.",
      impact: "Medium",
    },
  ],
  listingCopy: {
    title:
      "CalmLeaf Magnesium Glycinate 200mg - Gentle Magnesium Support for Sleep, Muscles & Daily Wellness - 120 Easy-Swallow Capsules",
    bullets: [
      "Magnesium glycinate form: clearly labeled for shoppers comparing glycinate vs. citrate.",
      "Designed for nightly wellness routines supporting sleep quality and muscle relaxation.",
      "Gentle daily capsules with transparent 200mg serving information.",
      "Non-GMO formula in a 120-capsule bottle for consistent daily use.",
      "Add lab-testing or certification proof here only if verified for this product.",
    ],
    faq: [
      {
        question: "Is this suitable for older adults?",
        answer:
          "Older adults should review the serving size and consult a healthcare professional, especially when taking medications or managing kidney, heart, or blood pressure conditions.",
      },
      {
        question: "What form of magnesium is used?",
        answer: "This product uses magnesium glycinate, a form commonly chosen by shoppers looking for gentle daily magnesium support.",
      },
      {
        question: "Is it third-party tested?",
        answer: "Add the exact testing details here only if they are verified for this product.",
      },
    ],
    description:
      "CalmLeaf Magnesium Glycinate 200mg is built for shoppers who want a clear, gentle magnesium option for sleep, muscle relaxation, and daily wellness routines. The listing should strengthen proof around testing, dosage clarity, and older-adult safety to compete in AI-generated recommendations.",
  },
};

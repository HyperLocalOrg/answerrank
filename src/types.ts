export type AuditInput = {
  productUrl: string;
  brandName: string;
  productName: string;
  category: string;
  targetQuery: string;
  competitors: string;
  productCopy: string;
  liveMode: boolean;
  forceRefresh?: boolean;
};

export type ProductContext = {
  url?: string;
  brandName: string;
  productName: string;
  category: string;
  title: string;
  bullets: string[];
  description: string;
  rating?: string;
  reviewCount?: string;
  competitors: string[];
};

export type ModelResult = {
  model: string;
  query: string;
  brandMentioned: boolean;
  rankPosition: number | null;
  recommendationStrength: "strong" | "positive" | "neutral" | "weak" | "negative";
  mentionedCompetitors: string[];
  buyerCriteria: string[];
  missingSignals: string[];
  reasonsForLoss: string[];
  summary: string;
  rawAnswer: string;
};

export type CoverageItem = {
  criterion: string;
  coverage: number;
  status: "Strong" | "Partial" | "Missing";
  evidence: string;
  fix: string;
  impact: "High" | "Medium" | "Low";
};

export type ScoreBreakdown = {
  mentionVisibility: number;
  rankingPosition: number;
  trustSignalCoverage: number;
  competitiveDifferentiation: number;
  sentiment: number;
  contentReadiness: number;
  overall: number;
};

export type ListingCopy = {
  title: string;
  bullets: string[];
  faq: { question: string; answer: string }[];
  description: string;
};

export type AuditReport = {
  id: string;
  saved?: boolean;
  cached?: boolean;
  cacheStatus?: "hit" | "miss" | "demo" | "shared";
  cacheAgeMinutes?: number;
  cacheWindowHours?: number;
  createdAt: string;
  product: ProductContext;
  targetQuery: string;
  generatedQueries: string[];
  modelResults: ModelResult[];
  coverage: CoverageItem[];
  scores: ScoreBreakdown;
  status: "Strong" | "Good" | "At Risk" | "Invisible";
  executiveSummary: string;
  competitorInsights: {
    competitor: string;
    modelsMentioned: string[];
    reason: string;
    edge: string;
  }[];
  roadmap: {
    priority: number;
    title: string;
    why: string;
    change: string;
    impact: "High" | "Medium" | "Low";
  }[];
  listingCopy: ListingCopy;
};

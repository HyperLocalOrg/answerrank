import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { sampleInput, sampleReport } from "./data/sample";
import { runAudit } from "./services/audit";
import type { AuditInput, AuditReport, ScoreBreakdown } from "./types";
import {
  copyShareLink,
  downloadReportPdf,
  loadSavedReport,
  readReportFromHash,
  readReportIdFromUrl,
} from "./utils/export";
import "./styles.css";

// ── Score labels ─────────────────────────────────────────────────────────────
const SCORE_LABELS: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: "mentionVisibility",          label: "Mention Visibility"       },
  { key: "rankingPosition",            label: "Ranking Position"         },
  { key: "trustSignalCoverage",        label: "Trust Coverage"           },
  { key: "competitiveDifferentiation", label: "Differentiation"          },
  { key: "sentiment",                  label: "Recommendation Strength"  },
  { key: "contentReadiness",           label: "Content Readiness"        },
];

type RecentSearch = {
  product: string;
  url?: string;
  brandName?: string;
  productName?: string;
  query: string;
  time: string;
  createdAt: number;
};

const DEFAULT_RECENT: RecentSearch[] = [
  {
    product: "Magnesium Breakthrough",
    url: "amazon.com/biooptimizers-magnesium",
    query: "best magnesium for sleep and anxiety",
    time: "Example",
    createdAt: 0,
  },
  {
    product: "Sleep Formula Pro",
    url: "sleepformula.com/pro-blend",
    query: "best natural sleep supplement",
    time: "Example",
    createdAt: 0,
  },
  {
    product: "Omega 3 Elite",
    url: "amazon.com/omega3-elite",
    query: "best omega 3 supplement for heart health",
    time: "Example",
    createdAt: 0,
  },
];

const COLORS = { blue: "#2563EB", green: "#059669", red: "#DC2626", amber: "#D97706" };

// ── Icons ─────────────────────────────────────────────────────────────────────
const IcoTrophy = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="8 15 4 15 4 8 8 8"/><polyline points="16 15 20 15 20 8 16 8"/>
    <rect x="8" y="4" width="8" height="11" rx="1"/>
    <line x1="12" y1="15" x2="12" y2="19"/><line x1="9" y1="19" x2="15" y2="19"/>
  </svg>
);
const IcoSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IcoRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);
const IcoShare = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>
  </svg>
);
const IcoDownload = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
  </svg>
);
const IcoClock = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IcoZap = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);
const IcoCheck = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IcoX = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IcoSpinner = () => (
  <svg className="ar-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
  </svg>
);
const IcoChevron = ({ up }: { up: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={up ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"}/>
  </svg>
);

// ── Nav ───────────────────────────────────────────────────────────────────────
function Nav({
  hasResult,
  onNewReport,
  onShare,
  onExport,
  shareMessage,
}: {
  hasResult: boolean;
  onNewReport?: () => void;
  onShare?: () => void;
  onExport?: () => void;
  shareMessage?: string;
}) {
  return (
    <nav className="ar-nav">
      <div className="ar-nav-inner">
        <div className="ar-logo">
          <div className="ar-logo-icon"><IcoTrophy /></div>
          <span className="ar-logo-text">AnswerRank</span>
          <span className="ar-demo-badge"><IcoZap /> Demo · Gemini + Llama</span>
        </div>
        {hasResult && (
          <div className="ar-nav-actions">
            {shareMessage && <span className="ar-share-msg">{shareMessage}</span>}
            <button className="ar-btn-ghost" onClick={onShare}><IcoShare /><span>Share</span></button>
            <button className="ar-btn-ghost" onClick={onExport}><IcoDownload /><span>Export</span></button>
            <button className="ar-btn-ghost" onClick={onNewReport}><IcoRefresh /><span>New Report</span></button>
          </div>
        )}
      </div>
    </nav>
  );
}

// ── Landing ───────────────────────────────────────────────────────────────────
function ScreenLanding({
  onSubmit,
  error,
  recentSearches,
}: {
  onSubmit: (partial: Partial<AuditInput>) => void;
  error: string;
  recentSearches: RecentSearch[];
}) {
  const [hasUrl, setHasUrl] = useState(true);
  const [url, setUrl] = useState("");
  const [brand, setBrand] = useState("");
  const [product, setProduct] = useState("");
  const [query, setQuery] = useState("");
  const [liveMode, setLiveMode] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const canSubmit =
    query.trim().length > 0 &&
    (hasUrl ? url.trim().length > 2 : brand.trim().length > 0 && product.trim().length > 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      productUrl:  hasUrl ? url.trim() : undefined,
      brandName:   !hasUrl ? brand.trim()   : undefined,
      productName: !hasUrl ? product.trim() : undefined,
      targetQuery: query.trim(),
      liveMode,
    });
  }

  function handleRecent(r: RecentSearch) {
    setQuery(r.query);
    if (r.url) {
      setHasUrl(true);
      setUrl(r.url);
    } else {
      setHasUrl(false);
      setBrand(r.brandName || "");
      setProduct(r.productName || r.product);
    }
  }

  return (
    <div className="ar-landing">
      <Nav hasResult={false} />
      <div className="ar-landing-content ar-fade">

        {/* Hero */}
        <div className="ar-hero">
          <div className="ar-hero-icon"><IcoTrophy /></div>
          <div className="ar-aeo-badge">AEO Diagnostic Tool</div>
          <h1 className="ar-hero-h1">
            See how AI answers<br />
            <span className="ar-blue">questions about your product</span>
          </h1>
          <p className="ar-hero-sub">
            AnswerRank audits GPT, Gemini &amp; AI Search — so you know if you're visible when customers ask AI for recommendations.
          </p>
        </div>

        {/* Form card */}
        <div className="ar-card ar-form-card">

          {/* Toggle */}
          <div className="ar-toggle-row">
            {([
              { val: true,  icon: "🔗", label: "I have a product URL" },
              { val: false, icon: "✏️", label: "Enter brand & product" },
            ] as const).map(({ val, icon, label }) => (
              <button
                key={String(val)}
                type="button"
                className={`ar-toggle-btn${hasUrl === val ? " active" : ""}`}
                onClick={() => setHasUrl(val)}
              >
                <span className="ar-toggle-icon">{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>

          <form className="ar-form" onSubmit={handleSubmit}>
            {hasUrl ? (
              <div className="ar-field">
                <label className="ar-label">Product URL</label>
                <input
                  className={`ar-input${focused === "url" ? " focused" : ""}`}
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onFocus={() => setFocused("url")}
                  onBlur={() => setFocused(null)}
                  placeholder="amazon.com/your-product or shopify-store.com/product"
                />
              </div>
            ) : (
              <div className="ar-two-col">
                <div className="ar-field">
                  <label className="ar-label">Brand name</label>
                  <input
                    className={`ar-input${focused === "brand" ? " focused" : ""}`}
                    value={brand}
                    onChange={e => setBrand(e.target.value)}
                    onFocus={() => setFocused("brand")}
                    onBlur={() => setFocused(null)}
                    placeholder="e.g. BioOptimizers"
                  />
                </div>
                <div className="ar-field">
                  <label className="ar-label">Product name</label>
                  <input
                    className={`ar-input${focused === "product" ? " focused" : ""}`}
                    value={product}
                    onChange={e => setProduct(e.target.value)}
                    onFocus={() => setFocused("product")}
                    onBlur={() => setFocused(null)}
                    placeholder="e.g. Magnesium Breakthrough"
                  />
                </div>
              </div>
            )}

            <div className="ar-field">
              <label className="ar-label">Keyword / question customers ask</label>
              <input
                className={`ar-input${focused === "query" ? " focused" : ""}`}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setFocused("query")}
                onBlur={() => setFocused(null)}
                placeholder="e.g. best magnesium for sleep and anxiety"
              />
            </div>

            {error && <p className="ar-error">{error}</p>}

            <button
              type="submit"
              className="ar-btn-primary"
              disabled={!canSubmit}
              style={{ width: "100%", padding: "13px 20px", fontSize: 15 }}
            >
              <IcoSearch />
              Generate Report
            </button>

            <label className="ar-live-row">
              <input
                type="checkbox"
                checked={liveMode}
                onChange={e => setLiveMode(e.target.checked)}
              />
              Use live APIs (requires API keys)
            </label>
          </form>
        </div>

        {/* Recent searches */}
        <div>
          <span className="ar-section-label">Recent Searches</span>
          <div className="ar-recent-list">
            {recentSearches.map((r, i) => (
              <div key={i} className="ar-recent-item" onClick={() => handleRecent(r)}>
                <div className="ar-recent-info">
                  <p className="ar-recent-product">{r.product}</p>
                  <p className="ar-recent-url">{r.url || `${r.brandName || ""} ${r.productName || ""}`.trim()}</p>
                </div>
                <span className="ar-recent-time"><IcoClock />{r.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer stats */}
        <div className="ar-footer-stats">
          {[["3", "AI Models"], ["~10s", "Response time"], ["12h", "Results cached"]].map(([n, l]) => (
            <div key={l} className="ar-footer-stat">
              <div className="ar-footer-stat-num">{n}</div>
              <div className="ar-footer-stat-label">{l}</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

// ── Loading ───────────────────────────────────────────────────────────────────
const LOADING_MODELS = [
  { name: "GPT-4o",    label: "OpenAI" },
  { name: "Gemini",    label: "Google" },
  { name: "AI Search", label: "Perplexity / SearchGPT" },
];

function ScreenLoading({ identifier }: { identifier: string }) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 1000);
    const t2 = setTimeout(() => setStep(2), 2400);
    const t3 = setTimeout(() => setStep(3), 3600);
    let p = 0;
    const iv = setInterval(() => {
      p = Math.min(100, p + 2.2);
      setProgress(p);
      if (p >= 100) clearInterval(iv);
    }, 100);
    return () => { [t1, t2, t3].forEach(clearTimeout); clearInterval(iv); };
  }, []);

  return (
    <div className="ar-loading">
      <Nav hasResult={false} />
      <div className="ar-loading-content ar-fade">
        <div className="ar-card" style={{ padding: "36px 32px", textAlign: "center" }}>
          <div className="ar-loading-icon"><IcoSpinner /></div>
          <h2 className="ar-loading-title">Auditing AI models…</h2>
          <p className="ar-loading-sub">
            Querying models for <strong style={{ color: "#111827" }}>{identifier}</strong>
          </p>
          <div className="ar-progress-track">
            <div className="ar-progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <div className="ar-model-list">
            {LOADING_MODELS.map((m, i) => {
              const done   = step > i + 1;
              const active = step === i + 1;
              return (
                <div key={m.name} className={`ar-model-row${done ? " done" : active ? " active" : ""}`}>
                  <div className={`ar-model-dot${done ? " done" : active ? " active" : ""}`}>
                    {done   && <IcoCheck size={12} />}
                    {active && <IcoSpinner />}
                    {!done && !active && <span className="ar-dot-inner" />}
                  </div>
                  <div className="ar-model-info">
                    <p className="ar-model-name">{m.name}</p>
                    <p className="ar-model-label">{m.label}</p>
                  </div>
                  <span className={`ar-model-status${done ? " done" : active ? " active" : ""}`}>
                    {done ? "Done" : active ? "Running…" : "Pending"}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="ar-loading-note">This takes ~10 seconds · Cached 12 hours</p>
        </div>
      </div>
    </div>
  );
}

// ── Results: ScoreCard ────────────────────────────────────────────────────────
function ScoreCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div className="ar-card ar-score-card">
      <p className="ar-score-card-label">{label}</p>
      <p className="ar-score-card-value" style={color ? { color } : undefined}>{value}</p>
      {sub && <p className="ar-score-card-sub">{sub}</p>}
    </div>
  );
}

// ── Results: ModelColumn ──────────────────────────────────────────────────────
function ModelColumn({ result }: { result: AuditReport["modelResults"][number] }) {
  const scoreColor =
    result.scoreOutOf100 >= 60 ? COLORS.green :
    result.scoreOutOf100 >= 35 ? COLORS.amber : COLORS.red;

  const evidencePill =
    result.evidenceQuality === "strong"   ? "ar-pill-found"    :
    result.evidenceQuality === "moderate" ? "ar-pill-neutral"  : "ar-pill-missing";

  return (
    <div className="ar-model-col">
      {/* Header */}
      <div className={`ar-model-col-head${result.brandMentioned ? " found" : " missing"}`}>
        <div className="ar-model-col-title-row">
          <p className="ar-model-col-name">{result.model}</p>
          <span className={`ar-tag ${result.brandMentioned ? "ar-pill-found" : "ar-pill-missing"}`}>
            {result.brandMentioned ? <IcoCheck size={10} /> : <IcoX size={10} />}
            {result.brandMentioned ? `Rank #${result.rankPosition ?? "–"}` : "NOT MENTIONED"}
          </span>
        </div>
        {/* Score + meta row */}
        <div className="ar-model-col-meta">
          <span className="ar-model-col-score" style={{ color: scoreColor }}>{result.scoreOutOf100}</span>
          <span className={`ar-tag ${evidencePill}`}>{result.evidenceQuality}</span>
          <span className="ar-model-col-conf">
            {Math.round(result.confidence * 100)}% confidence
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="ar-model-col-body">
        <span className="ar-model-col-section-label">AI answer</span>
        <p className="ar-model-col-excerpt">
          "{result.summary.length > 160 ? result.summary.slice(0, 160) + "…" : result.summary}"
        </p>

        {result.topRecommendations.length > 0 && (
          <div className="ar-model-col-block">
            <span className="ar-model-col-section-label">Top 5 recommendations</span>
            <ol className="ar-top-recs">
              {result.topRecommendations.map((rec, i) => (
                <li key={i} className={rec.toLowerCase().includes(result.model.toLowerCase()) ? "ar-top-rec-ours" : ""}>
                  {rec}
                </li>
              ))}
            </ol>
          </div>
        )}

        {result.missingSignals.length > 0 && (
          <div className="ar-model-col-block">
            <span className="ar-model-col-section-label">Missing signals</span>
            <ul className="ar-signal-list ar-signal-missing">
              {result.missingSignals.slice(0, 3).map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}

        {result.reasonsForLoss.length > 0 && (
          <div className="ar-model-col-block">
            <span className="ar-model-col-section-label">Why competitors win</span>
            <ul className="ar-signal-list ar-signal-loss">
              {result.reasonsForLoss.slice(0, 3).map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}

        {result.mentionedCompetitors.length > 0 && (
          <div className="ar-model-col-block">
            <span className="ar-model-col-section-label">Cited instead</span>
            <div className="ar-competitor-chips">
              {result.mentionedCompetitors.slice(0, 4).map(c => (
                <span key={c} className="ar-chip-red">{c}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Results: CriteriaRow ──────────────────────────────────────────────────────
function CriteriaRow({ item }: { item: AuditReport["coverage"][number] }) {
  const s = item.status.toLowerCase();
  const color     = s === "strong" ? COLORS.green : s === "missing" ? COLORS.red : COLORS.amber;
  const pillClass = s === "strong" ? "ar-pill-found" : s === "missing" ? "ar-pill-missing" : "ar-pill-neutral";
  return (
    <div className="ar-criteria-row">
      <div className="ar-criteria-row-top">
        <div className="ar-criteria-row-info">
          <p className="ar-criteria-name">{item.criterion}</p>
          <p className="ar-criteria-evidence">{item.evidence}</p>
          {item.fix && <p className="ar-criteria-fix">{item.fix}</p>}
        </div>
        <div className="ar-criteria-right">
          <span className={`ar-tag ${pillClass}`}>{item.status}</span>
          <span className="ar-criteria-pct" style={{ color }}>{item.coverage}%</span>
        </div>
      </div>
      <div className="ar-bar-track">
        <div className="ar-bar-fill" style={{ width: `${item.coverage}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Results: Collapse ─────────────────────────────────────────────────────────
function Collapse({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="ar-card" style={{ marginBottom: 12, overflow: "hidden" }}>
      <button
        className="ar-collapse-btn"
        onClick={() => setOpen(o => !o)}
        style={{ borderBottom: open ? "1px solid #F3F4F6" : "none" }}
      >
        <div>
          <p className="ar-collapse-title">{title}</p>
          {subtitle && <p className="ar-collapse-sub">{subtitle}</p>}
        </div>
        <IcoChevron up={open} />
      </button>
      {open && <div className="ar-collapse-body">{children}</div>}
    </div>
  );
}

// ── Screen: Results ───────────────────────────────────────────────────────────
function ScreenResults({
  report,
  identifier,
  refreshing,
  shareMessage,
  onNewReport,
  onShare,
  onExport,
  onRefresh,
}: {
  report: AuditReport;
  identifier: string;
  refreshing: boolean;
  shareMessage: string;
  onNewReport: () => void;
  onShare: () => void;
  onExport: () => void;
  onRefresh: () => void;
}) {
  const overall    = report.scores.overall;
  const scoreColor = overall >= 70 ? COLORS.green : overall >= 40 ? COLORS.amber : COLORS.red;
  const today      = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const citedCount = report.modelResults.filter(r => r.brandMentioned).length;
  const bestRank   = report.modelResults
    .filter(r => r.brandMentioned && r.rankPosition != null)
    .reduce<number | null>((best, r) =>
      r.rankPosition == null ? best : best === null || r.rankPosition < best ? r.rankPosition : best,
      null,
    );

  const cacheLabel =
    report.cacheStatus === "hit"    ? "Cached result" :
    report.cacheStatus === "miss"   ? "Fresh audit"   :
    report.cacheStatus === "shared" ? "Shared report" : "Demo report";

  return (
    <div className="ar-results">
      <Nav
        hasResult
        onNewReport={onNewReport}
        onShare={onShare}
        onExport={onExport}
        shareMessage={shareMessage}
      />

      <div className="ar-results-layout">

        {/* Sidebar */}
        <aside className="ar-sidebar">
          <span className="ar-section-label" style={{ marginBottom: 12 }}>This report</span>

          <div
            className="ar-score-ring-card"
            style={{ borderColor: scoreColor + "44", background: scoreColor + "0e" }}
          >
            <div
              className="ar-score-ring"
              style={{ background: `conic-gradient(${scoreColor} ${overall * 3.6}deg, #E5E7EB 0deg)` }}
            >
              <div className="ar-score-ring-inner" style={{ color: scoreColor }}>{overall}</div>
            </div>
            <div>
              <p className="ar-score-ring-label">AI Visibility</p>
              <p className="ar-score-ring-sub">
                {overall < 40 ? "Low visibility" : overall < 70 ? "Partial" : "Strong"}
              </p>
            </div>
          </div>

          <div className="ar-sidebar-stats">
            {[
              { l: "Models cited in",   v: `${citedCount} / ${report.modelResults.length}` },
              { l: "Best rank",         v: bestRank != null ? `#${bestRank}` : "Not ranked" },
              { l: "Competitors found", v: `${report.competitorInsights.length} brands` },
              { l: "Status",            v: report.status },
            ].map(({ l, v }) => (
              <div key={l} className="ar-sidebar-stat-row">
                <span className="ar-sidebar-stat-label">{l}</span>
                <span className="ar-sidebar-stat-value">{v}</span>
              </div>
            ))}
          </div>

          <div className="ar-cache-badge">
            <p className="ar-cache-badge-title"><IcoZap />{cacheLabel}</p>
            <p className="ar-cache-badge-sub">Generated {today}</p>
            {report.storageError && <p className="ar-cache-badge-sub">Storage: {report.storageError}</p>}
          </div>

          <button
            className="ar-btn-ghost refresh-full"
            style={{ width: "100%", justifyContent: "center", fontSize: 12 }}
            onClick={onRefresh}
            disabled={refreshing}
          >
            <IcoRefresh />{refreshing ? "Refreshing…" : "Get Fresh Report"}
          </button>
        </aside>

        {/* Main */}
        <main className="ar-main">

          {/* Product header */}
          <div className="ar-product-header ar-fade">
            <h1 className="ar-product-name">{report.product.productName}</h1>
            <p className="ar-product-meta">
              {identifier && <><span className="ar-product-url">{identifier}</span> · </>}
              Brand: <em>{report.product.brandName}</em>
            </p>
            {report.executiveSummary && (
              <p className="ar-product-summary">{report.executiveSummary}</p>
            )}
          </div>

          {/* Score breakdown */}
          <div style={{ marginBottom: 16 }}>
            <span className="ar-section-label">
              Score Breakdown
              <span className="ar-section-label-note">— How well AI models rank and surface this product</span>
            </span>
            <div className="ar-score-row">
              {SCORE_LABELS.slice(0, 3).map(({ key, label }) => (
                <ScoreCard
                  key={key}
                  label={label}
                  value={report.scores[key]}
                  sub="out of 100"
                  color={key === "mentionVisibility" ? scoreColor : undefined}
                />
              ))}
            </div>
            <div className="ar-score-row" style={{ marginTop: 10 }}>
              {SCORE_LABELS.slice(3).map(({ key, label }) => (
                <ScoreCard key={key} label={label} value={report.scores[key]} />
              ))}
            </div>
          </div>

          {/* AI Model Results */}
          <Collapse title="AI Model Results" subtitle="How each AI engine cited or ignored this product" defaultOpen>
            <div className="ar-model-cols">
              {report.modelResults.map(r => (
                <ModelColumn key={`${r.model}-${r.query}`} result={r} />
              ))}
            </div>
          </Collapse>

          {/* Competitor Visibility */}
          <Collapse title="Competitor Visibility" subtitle="Brands AI assistants preferred, and the reason they had an edge" defaultOpen>
            <div className="ar-table-wrap">
              <table className="ar-table">
                <thead>
                  <tr>
                    {["Competitor", "Models", "Reason", "Edge"].map(h => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {report.competitorInsights.map((row, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600, color: "#111827", whiteSpace: "nowrap" }}>{row.competitor}</td>
                      <td style={{ color: "#6B7280", fontSize: 12, whiteSpace: "nowrap" }}>{row.modelsMentioned.join(", ")}</td>
                      <td style={{ color: "#4B5563", lineHeight: 1.5 }}>{row.reason}</td>
                      <td><span className="ar-tag ar-pill-neutral">{row.edge}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Collapse>

          {/* Buyer Criteria */}
          <Collapse title="Buyer Criteria Coverage" subtitle="How well the listing addresses what AI models look for" defaultOpen>
            <div>
              {report.coverage.map((item, i) => <CriteriaRow key={i} item={item} />)}
            </div>
          </Collapse>

          {/* Optimization Roadmap */}
          <Collapse title="Optimization Roadmap" subtitle="Prioritized fixes that turn the audit into an operator-ready action plan" defaultOpen>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {report.roadmap.map((item, i) => {
                const color = i === 0 ? COLORS.red : i === 1 ? COLORS.amber : COLORS.blue;
                return (
                  <div key={i} className="ar-opt-item" style={{ borderColor: color + "44", background: color + "06" }}>
                    <div className="ar-opt-num" style={{ background: color }}>{i + 1}</div>
                    <div className="ar-opt-body">
                      <p className="ar-opt-title">{item.title}</p>
                      <p className="ar-opt-why">{item.why}</p>
                      {item.change && <p className="ar-opt-change">{item.change}</p>}
                    </div>
                    <span
                      className="ar-opt-priority"
                      style={{ background: color + "1a", color }}
                    >
                      {item.impact ?? String(item.priority)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Collapse>

          {/* Generated Listing Improvements */}
          <Collapse title="Generated Listing Improvements" subtitle="Only use claims that are true for the product">
            <div className="ar-copy-block">
              <h4>Optimized title</h4>
              <p>{report.listingCopy.title}</p>
              <h4>Bullets</h4>
              <ul>{report.listingCopy.bullets.map(b => <li key={b}>{b}</li>)}</ul>
              <h4>FAQ</h4>
              {report.listingCopy.faq.map(item => (
                <div key={item.question} className="ar-faq">
                  <strong>{item.question}</strong>
                  <p>{item.answer}</p>
                </div>
              ))}
              <h4>AI-friendly description</h4>
              <p>{report.listingCopy.description}</p>
            </div>
          </Collapse>

          {/* Raw Evidence */}
          <Collapse title="Raw Evidence" subtitle="Collapsible model answers for trust and debugging">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {report.modelResults.map((r, i) => (
                <div key={i}>
                  <p className="ar-raw-model-name">{i + 1}. {r.model} answer</p>
                  <div className="ar-raw-evidence"><p>{r.rawAnswer}</p></div>
                </div>
              ))}
            </div>
          </Collapse>

        </main>
      </div>
    </div>
  );
}

// ── App Root ──────────────────────────────────────────────────────────────────
function App() {
  const [screen, setScreen]           = useState<"landing" | "loading" | "results">("landing");
  const [report, setReport]           = useState<AuditReport>(sampleReport);
  const [input, setInput]             = useState<AuditInput>(sampleInput);
  const [identifier, setIdentifier]   = useState("");
  const [error, setError]             = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [refreshing, setRefreshing]   = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(() => loadRecentFromStorage());

  useEffect(() => {
    const reportId = readReportIdFromUrl();
    if (reportId) {
      loadSavedReport(reportId)
        .then(r => { setReport(r); setScreen("results"); })
        .catch(() => setError("Saved report could not be loaded."));
      return;
    }
    const shared = readReportFromHash();
    if (shared) { setReport(shared); setScreen("results"); }
  }, []);

  // Load recent searches from DB; fall back to localStorage silently
  useEffect(() => {
    fetch("/api/recent")
      .then(r => r.json())
      .then((data: { recent?: Omit<RecentSearch, "time">[] }) => {
        if (data.recent?.length) {
          const withTime = data.recent.map(r => ({ ...r, time: relativeTime(r.createdAt) }));
          setRecentSearches(withTime);
          localStorage.setItem("answerrank:recent", JSON.stringify(withTime));
        }
      })
      .catch(() => {/* stay with localStorage */});
  }, []);

  async function handleSubmit(partial: Partial<AuditInput>) {
    const nextInput: AuditInput = { ...sampleInput, ...partial };
    const id = partial.productUrl?.trim()
      ? partial.productUrl.trim()
      : `${partial.brandName ?? ""} – ${partial.productName ?? ""}`.trim();

    setInput(nextInput);
    setIdentifier(id);
    setError("");
    setShareMessage("");
    setScreen("loading");

    const minWait = new Promise<void>(r => setTimeout(r, 4800));
    try {
      const result = await runAudit(nextInput);
      await minWait;
      setReport(result);
      rememberSearch(nextInput, result, setRecentSearches);
      setScreen("results");
    } catch (err) {
      await minWait;
      setError(err instanceof Error ? err.message : "Audit failed. Try demo mode or check API keys.");
      setScreen("landing");
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const result = await runAudit({ ...input, liveMode: true, forceRefresh: true });
      setReport(result);
    } catch (err) {
      setShareMessage(err instanceof Error ? err.message : "Refresh failed.");
      setTimeout(() => setShareMessage(""), 3000);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleShare() {
    try {
      await copyShareLink(report);
      setShareMessage("Link copied!");
    } catch {
      setShareMessage("Could not copy link.");
    }
    setTimeout(() => setShareMessage(""), 3000);
  }

  return (
    <>
      {screen === "landing" && (
        <ScreenLanding onSubmit={handleSubmit} error={error} recentSearches={recentSearches} />
      )}
      {screen === "loading" && (
        <ScreenLoading identifier={identifier} />
      )}
      {screen === "results" && (
        <ScreenResults
          report={report}
          identifier={identifier}
          refreshing={refreshing}
          shareMessage={shareMessage}
          onNewReport={() => setScreen("landing")}
          onShare={handleShare}
          onExport={() => downloadReportPdf(report)}
          onRefresh={handleRefresh}
        />
      )}
    </>
  );
}

function loadRecentFromStorage(): RecentSearch[] {
  try {
    const stored = localStorage.getItem("answerrank:recent");
    if (!stored) return DEFAULT_RECENT;
    const parsed = JSON.parse(stored) as RecentSearch[];
    return parsed.length ? parsed : DEFAULT_RECENT;
  } catch {
    return DEFAULT_RECENT;
  }
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function rememberSearch(
  input: AuditInput,
  report: AuditReport,
  setRecentSearches: React.Dispatch<React.SetStateAction<RecentSearch[]>>,
) {
  const item: RecentSearch = {
    product: report.product.productName,
    url: input.productUrl || undefined,
    brandName: input.brandName || report.product.brandName,
    productName: input.productName || report.product.productName,
    query: input.targetQuery,
    time: relativeTime(Date.now()),
    createdAt: Date.now(),
  };

  setRecentSearches((current) => {
    const deduped = current.filter((existing) => {
      const sameUrl = item.url && existing.url === item.url;
      const sameManual =
        !item.url &&
        existing.brandName === item.brandName &&
        existing.productName === item.productName &&
        existing.query === item.query;
      return !sameUrl && !sameManual;
    });
    const next = [item, ...deduped].slice(0, 5);
    localStorage.setItem("answerrank:recent", JSON.stringify(next));
    return next;
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

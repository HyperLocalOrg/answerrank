import { useState } from "react";
import Nav from "../components/Nav";
import {
  IcoCheck,
  IcoX,
  IcoZap,
  IcoRefresh,
  IcoChevron,
} from "../components/icons";
import type { AuditReport, ScoreBreakdown } from "../types";

// ── Score labels ──────────────────────────────────────────────────────────────
const SCORE_LABELS: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: "mentionVisibility", label: "Mention Visibility" },
  { key: "rankingPosition", label: "Ranking Position" },
  { key: "trustSignalCoverage", label: "Trust Coverage" },
  { key: "competitiveDifferentiation", label: "Differentiation" },
  { key: "sentiment", label: "Recommendation Strength" },
  { key: "contentReadiness", label: "Content Readiness" },
];

export const COLORS = { blue: "#2563EB", green: "#059669", red: "#DC2626", amber: "#D97706" };

// ── ScoreCard ─────────────────────────────────────────────────────────────────
function ScoreCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div className="ar-card ar-score-card">
      <p className="ar-score-card-label">{label}</p>
      <p className="ar-score-card-value" style={color ? { color } : undefined}>{value}</p>
      {sub && <p className="ar-score-card-sub">{sub}</p>}
    </div>
  );
}

// ── ModelColumn ───────────────────────────────────────────────────────────────
function ModelColumn({ result }: { result: AuditReport["modelResults"][number] }) {
  const scoreColor =
    result.scoreOutOf100 >= 60 ? COLORS.green :
      result.scoreOutOf100 >= 35 ? COLORS.amber : COLORS.red;

  const evidencePill =
    result.evidenceQuality === "strong" ? "ar-pill-found" :
      result.evidenceQuality === "moderate" ? "ar-pill-neutral" : "ar-pill-missing";

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

// ── CriteriaRow ───────────────────────────────────────────────────────────────
function CriteriaRow({ item }: { item: AuditReport["coverage"][number] }) {
  const s = item.status.toLowerCase();
  const color = s === "strong" ? COLORS.green : s === "missing" ? COLORS.red : COLORS.amber;
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

// ── Collapse ──────────────────────────────────────────────────────────────────
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

// ── ResultsPage ───────────────────────────────────────────────────────────────
export default function ResultsPage({
  report,
  identifier,
  shareMessage,
  onNewReport,
  onShare,
  onExport,
  onRefresh,
}: {
  report: AuditReport;
  identifier: string;
  shareMessage: string;
  onNewReport: () => void;
  onShare: () => void;
  onExport: () => void;
  onRefresh: () => void;
}) {
  const overall = report.scores.overall;
  const scoreColor = overall >= 70 ? COLORS.green : overall >= 40 ? COLORS.amber : COLORS.red;
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const citedCount = report.modelResults.filter(r => r.brandMentioned).length;
  const bestRank = report.modelResults
    .filter(r => r.brandMentioned && r.rankPosition != null)
    .reduce<number | null>((best, r) =>
      r.rankPosition == null ? best : best === null || r.rankPosition < best ? r.rankPosition : best,
      null,
    );

  const cacheLabel =
    report.cacheStatus === "hit" ? "Cached result" :
      report.cacheStatus === "miss" ? "Fresh audit" :
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
              { l: "Models cited in", v: `${citedCount} / ${report.modelResults.length}` },
              { l: "Best rank", v: bestRank != null ? `#${bestRank}` : "Not ranked" },
              { l: "Competitors found", v: `${report.competitorInsights.length} brands` },
              { l: "Status", v: report.status },
            ].map(({ l, v }) => (
              <div key={l} className="ar-sidebar-stat-row">
                <span className="ar-sidebar-stat-label">{l}</span>
                <span className="ar-sidebar-stat-value">{v}</span>
              </div>
            ))}
          </div>

          <div className="ar-cache-badge">
            <p className="ar-cache-badge-title"><IcoZap />{cacheLabel}</p>
            <p className="ar-cache-badge-sub">
              {report.cacheStatus === "hit" && report.cacheAgeMinutes != null
                ? `Cached ${report.cacheAgeMinutes < 60 ? `${report.cacheAgeMinutes}m` : `${Math.floor(report.cacheAgeMinutes / 60)}h ${report.cacheAgeMinutes % 60}m`} ago`
                : `Generated ${today}`}
            </p>
            {report.storageError && <p className="ar-cache-badge-sub">Storage: {report.storageError}</p>}
          </div>

          <button
            className="ar-btn-ghost refresh-full"
            style={{ width: "100%", justifyContent: "center", fontSize: 12 }}
            onClick={onRefresh}
          >
            <IcoRefresh />Get Fresh Report
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
          <Collapse title="Generated Listing Improvements" subtitle="Only use claims that are true for the product" defaultOpen>
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

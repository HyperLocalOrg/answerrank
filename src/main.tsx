import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { sampleInput, sampleReport } from "./data/sample";
import { runAudit } from "./services/audit";
import type { AuditInput, AuditReport, ScoreBreakdown } from "./types";
import { copyShareLink, downloadReportJson, loadSavedReport, readReportFromHash, readReportIdFromUrl } from "./utils/export";
import "./styles.css";

const scoreLabels: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: "mentionVisibility", label: "Mention visibility" },
  { key: "rankingPosition", label: "Ranking position" },
  { key: "trustSignalCoverage", label: "Trust coverage" },
  { key: "competitiveDifferentiation", label: "Differentiation" },
  { key: "sentiment", label: "Recommendation strength" },
  { key: "contentReadiness", label: "Content readiness" },
];

function App() {
  const [input, setInput] = useState<AuditInput>(sampleInput);
  const [report, setReport] = useState<AuditReport>(sampleReport);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [inputMode, setInputMode] = useState<"url" | "manual">("url");

  useEffect(() => {
    const reportId = readReportIdFromUrl();
    if (reportId) {
      loadSavedReport(reportId)
        .then(setReport)
        .catch(() => setError("Saved report could not be loaded. The demo report is still available."));
      return;
    }

    const shared = readReportFromHash();
    if (shared) setReport(shared);
  }, []);

  const apiStatus = useMemo(() => {
    const liveReady = input.liveMode;
    return [
      { name: "Vercel API", present: liveReady },
      { name: "Gemini/Groq", present: liveReady },
      { name: "Supabase reports", present: liveReady },
    ];
  }, [input.liveMode]);

  async function handleRunAudit(event: React.FormEvent) {
    event.preventDefault();
    const hasUrl = Boolean(input.productUrl?.trim());
    const hasBrandAndProduct = Boolean(input.brandName?.trim() && input.productName?.trim());

    if (inputMode === "url" && !hasUrl) {
      setError("Add a product URL, or switch to Brand + Product mode.");
      return;
    }

    if (inputMode === "manual" && !hasBrandAndProduct) {
      setError("Enter both brand name and product name, or switch to URL mode.");
      return;
    }

    await executeAudit(input);
  }

  async function executeAudit(nextInput: AuditInput) {
    setLoading(true);
    setError("");
    setShareMessage("");
    try {
      const result = await runAudit(nextInput);
      setReport(result);
      window.location.hash = "";
      if (window.location.search) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed. Try demo mode or check API keys.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefreshAudit() {
    await executeAudit({ ...input, liveMode: true, forceRefresh: true });
  }

  async function handleShare() {
    try {
      await copyShareLink(report);
      setShareMessage("Share link copied.");
    } catch {
      setShareMessage("Could not copy link. JSON export still works.");
    }
  }

  return (
    <main className="app-shell">
      <section className="tool-panel">
        <div className="brand-row">
          <div>
            <p className="eyebrow">AI search visibility audit</p>
            <h1>AnswerRank</h1>
          </div>
          <div className="mode-pill">Built for ecommerce operators</div>
        </div>

        <form className="audit-form" onSubmit={handleRunAudit}>
          <div className="segmented-control" aria-label="Product input mode">
            <button
              type="button"
              className={inputMode === "url" ? "active" : ""}
              onClick={() => setInputMode("url")}
            >
              I have a URL
            </button>
            <button
              type="button"
              className={inputMode === "manual" ? "active" : ""}
              onClick={() => setInputMode("manual")}
            >
              No URL
            </button>
          </div>

          {inputMode === "url" ? (
            <label>
              Product URL
              <input
                value={input.productUrl || ""}
                onChange={(event) => setInput({ ...input, productUrl: event.target.value })}
                placeholder="https://amazon.com/..."
                required
              />
            </label>
          ) : (
            <div className="two-col">
              <label>
                Brand name
                <input
                  value={input.brandName || ""}
                  onChange={(event) => setInput({ ...input, brandName: event.target.value })}
                  placeholder="CalmLeaf"
                  required
                />
              </label>
              <label>
                Product name
                <input
                  value={input.productName || ""}
                  onChange={(event) => setInput({ ...input, productName: event.target.value })}
                  placeholder="Magnesium Glycinate 200mg"
                  required
                />
              </label>
            </div>
          )}

          <label>
            Target buyer query
            <input
              value={input.targetQuery}
              onChange={(event) => setInput({ ...input, targetQuery: event.target.value })}
              placeholder="best magnesium supplement for seniors"
              required
            />
          </label>

          <div className="form-footer">
            <label className="switch-row">
              <input
                type="checkbox"
                checked={input.liveMode}
                onChange={(event) => setInput({ ...input, liveMode: event.target.checked })}
              />
              Live APIs
            </label>
            <button type="submit" disabled={loading}>
              {loading ? "Running audit..." : "Run AI visibility audit"}
            </button>
          </div>
          {error && <p className="error-text">{error}</p>}
        </form>

        <div className="api-strip">
          {apiStatus.map((api) => (
            <span key={api.name} className={api.present ? "ok" : ""}>
              {api.name}: {api.present ? "ready" : "demo fallback"}
            </span>
          ))}
        </div>
      </section>

      <section className="report-panel">
        <ReportHeader
          report={report}
          refreshing={loading}
          onExport={() => downloadReportJson(report)}
          onRefresh={handleRefreshAudit}
          onShare={handleShare}
        />
        {shareMessage && <p className="share-message">{shareMessage}</p>}
        <ScoreGrid scores={report.scores} />
        <ModelResults report={report} />
        <Competitors report={report} />
        <Coverage report={report} />
        <Roadmap report={report} />
        <GeneratedCopy report={report} />
        <RawEvidence report={report} />
      </section>
    </main>
  );
}

function ReportHeader({
  report,
  refreshing,
  onExport,
  onRefresh,
  onShare,
}: {
  report: AuditReport;
  refreshing: boolean;
  onExport: () => void;
  onRefresh: () => void;
  onShare: () => void;
}) {
  return (
    <div className="report-header">
      <div>
        <p className="eyebrow">Report for {report.product.brandName}</p>
        <h2>{report.product.productName}</h2>
        <p>{report.executiveSummary}</p>
      </div>
      <div className="score-tower">
        <span className={`status ${report.status.toLowerCase().replace(/\s+/g, "-")}`}>{report.status}</span>
        <strong>{report.scores.overall}</strong>
        <span>/ 100 AEO score</span>
        <CacheIndicator report={report} />
        <div className="report-actions">
          <button type="button" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Run fresh"}
          </button>
          <button type="button" onClick={onShare}>
            Share
          </button>
          <button type="button" onClick={onExport}>
            Export JSON
          </button>
        </div>
      </div>
    </div>
  );
}

function CacheIndicator({ report }: { report: AuditReport }) {
  if (report.cacheStatus === "hit") {
    return (
      <span className="cache-pill hit">
        Cache hit
        {typeof report.cacheAgeMinutes === "number" ? ` · ${report.cacheAgeMinutes}m old` : ""}
      </span>
    );
  }

  if (report.cacheStatus === "miss") {
    return <span className="cache-pill miss">Cache miss · fresh audit</span>;
  }

  if (report.cacheStatus === "shared") {
    return <span className="cache-pill shared">Shared saved report</span>;
  }

  return <span className="cache-pill demo">Demo report</span>;
}

function ScoreGrid({ scores }: { scores: ScoreBreakdown }) {
  return (
    <section className="module">
      <div className="module-title">
        <h3>Score Breakdown</h3>
        <p>Transparent scoring inspired by generative engine visibility and RAG evaluation concepts.</p>
      </div>
      <div className="score-grid">
        {scoreLabels.map((item) => (
          <div className="score-card" key={item.key}>
            <span>{item.label}</span>
            <strong>{scores[item.key]}</strong>
            <div className="bar">
              <i style={{ width: `${scores[item.key]}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ModelResults({ report }: { report: AuditReport }) {
  return (
    <section className="module">
      <div className="module-title">
        <h3>AI Model Results</h3>
        <p>How each AI engine or simulator sees the product for the target query.</p>
      </div>
      <div className="model-grid">
        {report.modelResults.map((result) => (
          <article className="model-card" key={`${result.model}-${result.query}`}>
            <div className="model-head">
              <strong>{result.model}</strong>
              <span className={result.brandMentioned ? "mentioned" : "missed"}>
                {result.brandMentioned ? `Rank ${result.rankPosition || "mentioned"}` : "Not mentioned"}
              </span>
            </div>
            <p>{result.summary}</p>
            <div className="chip-row">
              <span>{result.recommendationStrength}</span>
              {result.mentionedCompetitors.slice(0, 3).map((competitor) => (
                <span key={competitor}>{competitor}</span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Competitors({ report }: { report: AuditReport }) {
  return (
    <section className="module">
      <div className="module-title">
        <h3>Competitor Visibility</h3>
        <p>Brands AI assistants preferred, and the reason they had an edge.</p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Competitor</th>
              <th>Models</th>
              <th>Reason</th>
              <th>Edge</th>
            </tr>
          </thead>
          <tbody>
            {report.competitorInsights.map((insight) => (
              <tr key={insight.competitor}>
                <td>{insight.competitor}</td>
                <td>{insight.modelsMentioned.join(", ")}</td>
                <td>{insight.reason}</td>
                <td>{insight.edge}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Coverage({ report }: { report: AuditReport }) {
  return (
    <section className="module">
      <div className="module-title">
        <h3>Buyer Criteria Coverage</h3>
        <p>Lightweight ML-style semantic coverage between model criteria and listing copy.</p>
      </div>
      <div className="coverage-list">
        {report.coverage.map((item) => (
          <article className="coverage-item" key={item.criterion}>
            <div>
              <strong>{item.criterion}</strong>
              <p>{item.evidence}</p>
              <small>{item.fix}</small>
            </div>
            <div className="coverage-score">
              <span className={item.status.toLowerCase()}>{item.status}</span>
              <strong>{item.coverage}%</strong>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Roadmap({ report }: { report: AuditReport }) {
  return (
    <section className="module">
      <div className="module-title">
        <h3>Optimization Roadmap</h3>
        <p>Prioritized fixes that turn the audit into an operator-ready action plan.</p>
      </div>
      <div className="roadmap">
        {report.roadmap.map((item) => (
          <article key={item.priority}>
            <span>{item.priority}</span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.why}</p>
              <small>{item.change}</small>
            </div>
            <b>{item.impact}</b>
          </article>
        ))}
      </div>
    </section>
  );
}

function GeneratedCopy({ report }: { report: AuditReport }) {
  return (
    <section className="module">
      <div className="module-title">
        <h3>Generated Listing Improvements</h3>
        <p>Only use claims that are true for the product.</p>
      </div>
      <div className="copy-block">
        <h4>Optimized title</h4>
        <p>{report.listingCopy.title}</p>
        <h4>Bullets</h4>
        <ul>
          {report.listingCopy.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
        <h4>FAQ</h4>
        {report.listingCopy.faq.map((item) => (
          <div className="faq" key={item.question}>
            <strong>{item.question}</strong>
            <p>{item.answer}</p>
          </div>
        ))}
        <h4>AI-friendly description</h4>
        <p>{report.listingCopy.description}</p>
      </div>
    </section>
  );
}

function RawEvidence({ report }: { report: AuditReport }) {
  return (
    <section className="module">
      <div className="module-title">
        <h3>Raw Evidence</h3>
        <p>Collapsible model answers for trust and debugging.</p>
      </div>
      {report.modelResults.map((result) => (
        <details key={`${result.model}-raw`}>
          <summary>{result.model} answer</summary>
          <p>{result.rawAnswer}</p>
        </details>
      ))}
    </section>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

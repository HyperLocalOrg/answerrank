import type { AuditReport } from "../types";

export function downloadReportJson(report: AuditReport): void {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `answerrank-${report.product.brandName.toLowerCase().replace(/\s+/g, "-")}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadReportPdf(report: AuditReport): void {
  const scoreColor =
    report.scores.overall >= 70 ? "#059669" : report.scores.overall >= 40 ? "#D97706" : "#DC2626";

  const statusColor: Record<string, string> = {
    Strong: "#059669",
    Good: "#2563EB",
    "At Risk": "#D97706",
    Invisible: "#DC2626",
  };

  const rankBadge = (ctx: string) => {
    if (ctx === "top3") return `<span class="badge badge-green">Top 3</span>`;
    if (ctx === "mentioned") return `<span class="badge badge-amber">Mentioned</span>`;
    return `<span class="badge badge-red">Not Found</span>`;
  };

  const evidenceBadge = (eq: string) => {
    const map: Record<string, string> = {
      strong: "badge-green",
      moderate: "badge-blue",
      weak: "badge-amber",
      none: "badge-red",
    };
    return `<span class="badge ${map[eq] ?? "badge-red"}">${eq.charAt(0).toUpperCase() + eq.slice(1)}</span>`;
  };

  const impactDot = (impact: string) => {
    const c = impact === "High" ? "#DC2626" : impact === "Medium" ? "#D97706" : "#059669";
    return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:6px;"></span>`;
  };

  const progressBar = (pct: number, color: string) =>
    `<div style="background:#e5e7eb;border-radius:99px;height:6px;width:100%;margin-top:4px;">
      <div style="background:${color};border-radius:99px;height:6px;width:${Math.min(100, pct)}%;"></div>
    </div>`;

  const modelCards = report.modelResults
    .map((r) => {
      const sc = r.scoreOutOf100 ?? 0;
      const col = sc >= 70 ? "#059669" : sc >= 40 ? "#D97706" : "#DC2626";
      const recs = (r.topRecommendations ?? [])
        .map((t, i) => `<li style="margin:4px 0;">${i + 1}. ${escapeHtml(t)}</li>`)
        .join("");
      const missing = (r.missingSignals ?? [])
        .map((s) => `<span class="chip chip-red">${escapeHtml(s)}</span>`)
        .join(" ");
      const losses = (r.reasonsForLoss ?? [])
        .map((s) => `<span class="chip chip-amber">${escapeHtml(s)}</span>`)
        .join(" ");
      return `
        <div class="model-card">
          <div class="model-header">
            <div>
              <div class="model-name">${escapeHtml(r.model)}</div>
              <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">
                ${rankBadge(r.rankContext ?? (r.brandMentioned ? "mentioned" : "not_mentioned"))}
                ${evidenceBadge(r.evidenceQuality ?? "none")}
              </div>
            </div>
            <div class="score-circle" style="border-color:${col};color:${col};">
              <div class="score-num">${sc}</div>
              <div class="score-lbl">/ 100</div>
            </div>
          </div>
          <p style="color:#374151;margin:10px 0 6px;font-size:13px;">${escapeHtml(r.summary)}</p>
          ${recs ? `<div style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-top:10px;">Top Recommendations</div><ol style="margin:4px 0 0;padding-left:0;list-style:none;font-size:13px;color:#111827;">${recs}</ol>` : ""}
          ${missing ? `<div style="margin-top:8px;"><span style="font-size:11px;font-weight:600;color:#DC2626;text-transform:uppercase;letter-spacing:.05em;">Missing Signals</span><div style="margin-top:4px;">${missing}</div></div>` : ""}
          ${losses ? `<div style="margin-top:8px;"><span style="font-size:11px;font-weight:600;color:#D97706;text-transform:uppercase;letter-spacing:.05em;">Why Ranked Lower</span><div style="margin-top:4px;">${losses}</div></div>` : ""}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;">
            ${[
              ["Relevance", r.relevanceScore],
              ["Visibility", r.visibilityScore],
              ["Evidence", r.evidenceScore],
              ["Competitive", r.competitivenessScore],
            ]
              .map(
                ([label, val]) =>
                  `<div><div style="display:flex;justify-content:space-between;font-size:12px;color:#6b7280;"><span>${label}</span><span style="font-weight:600;color:#111827;">${val ?? 0}</span></div>${progressBar(Number(val ?? 0), "#2563EB")}</div>`,
              )
              .join("")}
          </div>
        </div>`;
    })
    .join("");

  const competitorRows = report.competitorInsights
    .map(
      (row) => `
      <tr>
        <td><strong>${escapeHtml(row.competitor)}</strong></td>
        <td>${row.modelsMentioned.map((m) => `<span class="chip chip-blue">${escapeHtml(m)}</span>`).join(" ")}</td>
        <td style="color:#374151;">${escapeHtml(row.reason)}</td>
        <td style="color:#059669;font-size:12px;">${escapeHtml(row.edge)}</td>
      </tr>`,
    )
    .join("");

  const coverageRows = report.coverage
    .map((item) => {
      const statusC = item.status === "Strong" ? "#059669" : item.status === "Partial" ? "#D97706" : "#DC2626";
      return `<tr>
        <td><strong>${escapeHtml(item.criterion)}</strong></td>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-weight:600;color:${statusC};">${item.coverage}%</span>
            <div style="flex:1;background:#e5e7eb;border-radius:99px;height:6px;">
              <div style="background:${statusC};border-radius:99px;height:6px;width:${item.coverage}%;"></div>
            </div>
          </div>
        </td>
        <td><span class="badge" style="background:${statusC}1a;color:${statusC};border:1px solid ${statusC}33;">${escapeHtml(item.status)}</span></td>
        <td style="font-size:12px;color:#374151;">${escapeHtml(item.fix)}</td>
      </tr>`;
    })
    .join("");

  const roadmapCards = report.roadmap
    .map(
      (item) => `
      <div class="roadmap-card">
        <div class="roadmap-num">${item.priority}</div>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <strong style="font-size:14px;">${escapeHtml(item.title)}</strong>
            <span style="font-size:11px;">${impactDot(item.impact)}<span style="color:#6b7280;">${escapeHtml(item.impact)} Impact</span></span>
          </div>
          <p style="margin:0 0 4px;color:#374151;font-size:13px;">${escapeHtml(item.change)}</p>
          ${item.why ? `<p style="margin:0;color:#6b7280;font-size:12px;font-style:italic;">${escapeHtml(item.why)}</p>` : ""}
        </div>
      </div>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>AnswerRank Report — ${escapeHtml(report.product.productName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Inter',Arial,sans-serif;color:#111827;background:#f9fafb;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    @page{margin:12mm 14mm;}
    .page{max-width:900px;margin:0 auto;padding:28px 24px;}

    /* NAV */
    .nav{display:flex;align-items:center;justify-content:space-between;background:#fff;border-bottom:1px solid #e5e7eb;padding:14px 32px;margin-bottom:32px;}
    .nav-brand{font-size:18px;font-weight:700;color:#2563EB;letter-spacing:-.02em;}
    .nav-meta{font-size:13px;color:#6b7280;}

    /* HERO */
    .hero{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:28px 32px;display:flex;align-items:center;justify-content:space-between;gap:24px;margin-bottom:28px;}
    .hero-left h1{font-size:22px;font-weight:700;color:#111827;margin-bottom:4px;}
    .hero-left .query{font-size:14px;color:#6b7280;margin-bottom:12px;}
    .status-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:99px;font-size:12px;font-weight:600;border:1px solid;background:${statusColor[report.status] ?? "#2563EB"}1a;color:${statusColor[report.status] ?? "#2563EB"};border-color:${statusColor[report.status] ?? "#2563EB"}33;}
    .score-hero{text-align:center;flex-shrink:0;}
    .score-hero .num{font-size:56px;font-weight:700;line-height:1;color:${scoreColor};}
    .score-hero .lbl{font-size:12px;color:#6b7280;font-weight:500;text-transform:uppercase;letter-spacing:.06em;margin-top:2px;}
    .exec-summary{background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px 20px;color:#1e3a8a;font-size:14px;line-height:1.6;margin-bottom:28px;}

    /* SECTIONS */
    .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e5e7eb;}
    .section{margin-bottom:32px;}

    /* MODEL CARDS */
    .model-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:14px;}
    .model-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;}
    .model-name{font-size:16px;font-weight:700;color:#111827;}
    .score-circle{width:64px;height:64px;border-radius:50%;border:3px solid;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;}
    .score-num{font-size:20px;font-weight:700;line-height:1;}
    .score-lbl{font-size:10px;color:#9ca3af;line-height:1;}

    /* BADGES & CHIPS */
    .badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600;border:1px solid;}
    .badge-green{background:#d1fae5;color:#065f46;border-color:#6ee7b7;}
    .badge-blue{background:#dbeafe;color:#1e40af;border-color:#93c5fd;}
    .badge-amber{background:#fef3c7;color:#92400e;border-color:#fcd34d;}
    .badge-red{background:#fee2e2;color:#991b1b;border-color:#fca5a5;}
    .chip{display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:500;margin:2px;}
    .chip-blue{background:#eff6ff;color:#2563EB;}
    .chip-red{background:#fff1f2;color:#DC2626;}
    .chip-amber{background:#fffbeb;color:#D97706;}

    /* TABLE */
    table{width:100%;border-collapse:collapse;margin-top:4px;font-size:13px;}
    th{background:#f9fafb;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;padding:10px 12px;text-align:left;border-bottom:2px solid #e5e7eb;}
    td{padding:10px 12px;border-bottom:1px solid #f3f4f6;vertical-align:top;color:#374151;}
    tr:last-child td{border-bottom:none;}

    /* ROADMAP */
    .roadmap-card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px 18px;display:flex;gap:14px;margin-bottom:10px;align-items:flex-start;}
    .roadmap-num{width:28px;height:28px;border-radius:50%;background:#2563EB;color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}

    /* LISTING COPY */
    .copy-block{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;}
    .copy-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:6px;}
    .copy-text{font-size:13px;color:#111827;line-height:1.6;margin-bottom:16px;}
    .copy-text:last-child{margin-bottom:0;}

    /* PRINT BUTTON */
    .print-btn{display:flex;align-items:center;gap:8px;background:#2563EB;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;}
    .print-btn:hover{background:#1d4ed8;}

    /* FOOTER */
    .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;color:#9ca3af;font-size:12px;}

    @media print {
      body{background:#fff;}
      .print-bar{display:none!important;}
      .page{padding:16px 20px;}
      .hero{padding:16px 20px;margin-bottom:16px;}
      .exec-summary{margin-bottom:16px;padding:12px 16px;}
      .section{margin-bottom:16px;}
      .model-card{margin-bottom:8px;padding:14px 16px;break-inside:avoid;}
      .roadmap-card{margin-bottom:6px;padding:12px 14px;break-inside:avoid;}
      .copy-block{padding:14px 16px;break-inside:avoid;}
      table{break-inside:auto;}
      tr{break-inside:avoid;}
      .section-title{margin-bottom:8px;}
    }
  </style>
</head>
<body>
  <div class="print-bar" style="background:#fff;border-bottom:1px solid #e5e7eb;padding:12px 32px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10;">
    <span style="font-size:14px;color:#374151;font-weight:500;">AnswerRank AEO Report — ${escapeHtml(report.product.productName)}</span>
    <button class="print-btn" onclick="window.print()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      Save as PDF
    </button>
  </div>

  <div class="page">

    <!-- HERO -->
    <div class="hero">
      <div class="hero-left">
        <h1>${escapeHtml(report.product.productName)}</h1>
        <div class="query">"${escapeHtml(report.targetQuery)}"</div>
        <span class="status-badge">${escapeHtml(report.status)}</span>
        <div style="margin-top:10px;font-size:12px;color:#9ca3af;">
          ${report.product.brandName ? `<strong>${escapeHtml(report.product.brandName)}</strong> · ` : ""}
          ${report.product.category ? `${escapeHtml(report.product.category)} · ` : ""}
          ${new Date(report.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
        </div>
      </div>
      <div class="score-hero">
        <div class="num">${report.scores.overall}</div>
        <div class="lbl">AI Visibility Score</div>
      </div>
    </div>

    <!-- EXEC SUMMARY -->
    <div class="exec-summary">${escapeHtml(report.executiveSummary)}</div>

    <!-- MODEL RESULTS -->
    <div class="section">
      <div class="section-title">AI Model Results</div>
      ${modelCards}
    </div>

    <!-- SCORE BREAKDOWN -->
    <div class="section">
      <div class="section-title">Score Breakdown</div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
        ${[
          ["Mention Visibility", report.scores.mentionVisibility],
          ["Ranking Position", report.scores.rankingPosition],
          ["Trust Signals", report.scores.trustSignalCoverage],
          ["Competitive Diff.", report.scores.competitiveDifferentiation],
          ["Sentiment", report.scores.sentiment],
          ["Content Readiness", report.scores.contentReadiness],
        ]
          .map(([label, val]) => {
            const v = Number(val ?? 0);
            const c = v >= 70 ? "#059669" : v >= 40 ? "#D97706" : "#DC2626";
            return `<div>
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
                <span style="color:#6b7280;">${label}</span>
                <span style="font-weight:700;color:${c};">${v}</span>
              </div>
              ${progressBar(v, c)}
            </div>`;
          })
          .join("")}
      </div>
    </div>

    <!-- COMPETITOR INSIGHTS -->
    ${
      report.competitorInsights.length
        ? `<div class="section">
      <div class="section-title">Competitor Visibility</div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <table>
          <thead><tr><th>Competitor</th><th>Models</th><th>Why They Rank</th><th>Their Edge</th></tr></thead>
          <tbody>${competitorRows}</tbody>
        </table>
      </div>
    </div>`
        : ""
    }

    <!-- BUYER CRITERIA COVERAGE -->
    ${
      report.coverage.length
        ? `<div class="section">
      <div class="section-title">Buyer Criteria Coverage</div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <table>
          <thead><tr><th>Criterion</th><th style="width:180px;">Coverage</th><th>Status</th><th>Recommended Fix</th></tr></thead>
          <tbody>${coverageRows}</tbody>
        </table>
      </div>
    </div>`
        : ""
    }

    <!-- OPTIMIZATION ROADMAP -->
    ${
      report.roadmap.length
        ? `<div class="section">
      <div class="section-title">Optimization Roadmap</div>
      ${roadmapCards}
    </div>`
        : ""
    }

    <!-- LISTING COPY -->
    <div class="section">
      <div class="section-title">Generated Listing Improvements</div>
      <div class="copy-block">
        <div class="copy-label">Optimized Title</div>
        <div class="copy-text" style="font-weight:600;">${escapeHtml(report.listingCopy.title)}</div>

        <div class="copy-label">Bullet Points</div>
        <ul style="list-style:none;padding:0;margin-bottom:16px;">
          ${report.listingCopy.bullets.map((b) => `<li style="font-size:13px;color:#374151;padding:4px 0 4px 16px;position:relative;"><span style="position:absolute;left:0;color:#2563EB;">•</span>${escapeHtml(b)}</li>`).join("")}
        </ul>

        <div class="copy-label">Description</div>
        <div class="copy-text">${escapeHtml(report.listingCopy.description)}</div>

        ${
          report.listingCopy.faq?.length
            ? `<div class="copy-label">FAQ</div>
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${report.listingCopy.faq
              .map(
                (faq) =>
                  `<div style="background:#f9fafb;border-radius:8px;padding:12px 14px;"><div style="font-size:13px;font-weight:600;color:#111827;margin-bottom:4px;">Q: ${escapeHtml(faq.question)}</div><div style="font-size:13px;color:#374151;">A: ${escapeHtml(faq.answer)}</div></div>`,
              )
              .join("")}
          </div>`
            : ""
        }
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <span>Generated by <strong style="color:#2563EB;">AnswerRank</strong> — AEO Diagnostic</span>
      <span>${new Date(report.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
    </div>

  </div>
</body>
</html>`;

  const popup = window.open("", "_blank");
  if (!popup) return;
  popup.document.write(html);
  popup.document.close();
  popup.focus();
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function copyShareLink(report: AuditReport): Promise<string> {
  if (report.saved) {
    const url = `${window.location.origin}${window.location.pathname}?reportId=${encodeURIComponent(report.id)}`;
    await navigator.clipboard.writeText(url);
    return url;
  }

  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(report))));
  const url = `${window.location.origin}${window.location.pathname}#report=${encoded}`;
  await navigator.clipboard.writeText(url);
  return url;
}

export function readReportFromHash(): AuditReport | null {
  const match = window.location.hash.match(/report=([^&]+)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(escape(atob(match[1])))) as AuditReport;
  } catch {
    return null;
  }
}

export function readReportIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("reportId");
}

export async function loadSavedReport(id: string): Promise<AuditReport> {
  const response = await fetch(`/api/report?id=${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error("Could not load saved report");
  const data = await response.json();
  return { ...data.report, saved: true, cacheStatus: "shared" };
}

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
  const rows = report.competitorInsights
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.competitor)}</td>
          <td>${escapeHtml(row.modelsMentioned.join(", "))}</td>
          <td>${escapeHtml(row.reason)}</td>
          <td>${escapeHtml(row.edge)}</td>
        </tr>
      `,
    )
    .join("");

  const coverage = report.coverage
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.criterion)}</td>
          <td>${item.coverage}%</td>
          <td>${escapeHtml(item.status)}</td>
          <td>${escapeHtml(item.fix)}</td>
        </tr>
      `,
    )
    .join("");

  const roadmap = report.roadmap
    .map((item) => `<li><strong>${escapeHtml(item.title)}</strong><br/>${escapeHtml(item.change)}</li>`)
    .join("");

  const html = `
    <!doctype html>
    <html>
      <head>
        <title>AnswerRank Report - ${escapeHtml(report.product.productName)}</title>
        <style>
          body { color: #111827; font-family: Inter, Arial, sans-serif; margin: 32px; }
          h1 { margin-bottom: 4px; }
          h2 { border-bottom: 1px solid #e5e7eb; margin-top: 28px; padding-bottom: 8px; }
          .meta { color: #6b7280; }
          .score { border: 1px solid #d1d5db; border-radius: 10px; display: inline-block; margin: 18px 0; padding: 18px 22px; }
          .score strong { display: block; font-size: 42px; }
          table { border-collapse: collapse; margin-top: 12px; width: 100%; }
          th, td { border-bottom: 1px solid #e5e7eb; padding: 10px; text-align: left; vertical-align: top; }
          th { background: #f9fafb; font-size: 12px; text-transform: uppercase; }
          li { margin: 10px 0; }
          .copy { background: #f9fafb; border-radius: 10px; padding: 16px; }
          @media print { body { margin: 20mm; } button { display: none; } }
        </style>
      </head>
      <body>
        <button onclick="window.print()">Save as PDF</button>
        <h1>AnswerRank AEO Diagnostic</h1>
        <p class="meta">${escapeHtml(report.product.productName)} · ${escapeHtml(report.targetQuery)}</p>
        <div class="score"><span>AI Visibility Score</span><strong>${report.scores.overall}/100</strong><span>${escapeHtml(report.status)}</span></div>
        <p>${escapeHtml(report.executiveSummary)}</p>

        <h2>Model Results</h2>
        <table>
          <thead><tr><th>Model</th><th>Mentioned</th><th>Rank</th><th>Strength</th><th>Summary</th></tr></thead>
          <tbody>
            ${report.modelResults
              .map(
                (r) => `
                  <tr>
                    <td>${escapeHtml(r.model)}</td>
                    <td>${r.brandMentioned ? "Yes" : "No"}</td>
                    <td>${r.rankPosition ?? "-"}</td>
                    <td>${escapeHtml(r.recommendationStrength)}</td>
                    <td>${escapeHtml(r.summary)}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>

        <h2>Competitor Visibility</h2>
        <table><thead><tr><th>Competitor</th><th>Models</th><th>Reason</th><th>Edge</th></tr></thead><tbody>${rows}</tbody></table>

        <h2>Buyer Criteria Coverage</h2>
        <table><thead><tr><th>Criterion</th><th>Coverage</th><th>Status</th><th>Fix</th></tr></thead><tbody>${coverage}</tbody></table>

        <h2>Optimization Roadmap</h2>
        <ol>${roadmap}</ol>

        <h2>Generated Listing Improvements</h2>
        <div class="copy">
          <h3>Title</h3><p>${escapeHtml(report.listingCopy.title)}</p>
          <h3>Bullets</h3><ul>${report.listingCopy.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
          <h3>Description</h3><p>${escapeHtml(report.listingCopy.description)}</p>
        </div>
      </body>
    </html>
  `;

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

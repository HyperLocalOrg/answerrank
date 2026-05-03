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

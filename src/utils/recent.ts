import type React from "react";
import type { AuditInput, AuditReport } from "../types";

export type RecentSearch = {
  product: string;
  url?: string;
  brandName?: string;
  productName?: string;
  query: string;
  time: string;
  createdAt: number;
};

export const DEFAULT_RECENT: RecentSearch[] = []

// [
//   { product: "Magnesium Breakthrough", url: "amazon.com/biooptimizers-magnesium", query: "best magnesium for sleep and anxiety", time: "Example", createdAt: 0 },
//   { product: "Sleep Formula Pro", url: "sleepformula.com/pro-blend", query: "best natural sleep supplement", time: "Example", createdAt: 0 },
//   { product: "Omega 3 Elite", url: "amazon.com/omega3-elite", query: "best omega 3 supplement for heart health", time: "Example", createdAt: 0 },
// ];

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function loadRecentFromStorage(): RecentSearch[] {
  try {
    const stored = localStorage.getItem("answerrank:recent");
    if (!stored) return DEFAULT_RECENT;
    const parsed = JSON.parse(stored) as RecentSearch[];
    const cutoff = Date.now() - 12 * 60 * 60 * 1000;
    const fresh = parsed.filter(r => r.createdAt > cutoff);
    return fresh.length ? fresh : DEFAULT_RECENT;
  } catch {
    return DEFAULT_RECENT;
  }
}

export function rememberSearch(
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
      const sameManual = !item.url && existing.brandName === item.brandName && existing.productName === item.productName && existing.query === item.query;
      return !sameUrl && !sameManual;
    });
    const next = [item, ...deduped].slice(0, 5);
    localStorage.setItem("answerrank:recent", JSON.stringify(next));
    return next;
  });
}

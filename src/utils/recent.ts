export type RecentSearch = {
  reportId?: string;
  product: string;
  url?: string;
  brandName?: string;
  productName?: string;
  query: string;
  time: string;
  createdAt: number;
};

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

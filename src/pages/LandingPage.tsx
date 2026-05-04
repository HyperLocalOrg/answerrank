import React, { useState } from "react";
import Nav from "../components/Nav";
import { IcoTrophy, IcoZap, IcoSearch, IcoClock } from "../components/icons";
import type { RecentSearch } from "../utils/recent";
import type { AuditInput } from "../types";

export default function LandingPage({
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
  const [liveMode] = useState(true);
  const [focused, setFocused] = useState<string | null>(null);

  const canSubmit =
    query.trim().length > 0 &&
    (hasUrl ? url.trim().length > 2 : brand.trim().length > 0 && product.trim().length > 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      productUrl: hasUrl ? url.trim() : undefined,
      brandName: !hasUrl ? brand.trim() : undefined,
      productName: !hasUrl ? product.trim() : undefined,
      targetQuery: query.trim(),
      liveMode,
    });
  }

  function handleRecent(r: RecentSearch) {
    onSubmit({
      productUrl: r.url || "",
      brandName: r.brandName || "",
      productName: r.productName || r.product,
      targetQuery: r.query,
      liveMode: liveMode,
    });
  }

  return (
    <div className="ar-landing">
      <Nav hasResult={false} />
      <div className="ar-landing-content ar-fade">

        {/* Hero */}
        <div className="ar-hero">
          <div className="ar-hero-icon"><IcoTrophy /></div>
          <div className="ar-aeo-badge">AEO Diagnostic Tool</div>
          <div style={{ gap: 2 }} />
          <span className="ar-demo-badge"><IcoZap /> Demo · Gemini + Llama</span>
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
              { val: true, icon: "🔗", label: "I have a product URL" },
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
            <div style={{ height: 3 }} />
            <button
              type="submit"
              className="ar-btn-primary"
              disabled={!canSubmit}
              style={{ width: "100%", padding: "13px 20px", fontSize: 15 }}
            >
              <IcoSearch />
              Generate Report
            </button>
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
          {[["3", "AI Models"], ["~15s", "Response time"], ["12h", "Results cached"]].map(([n, l]) => (
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

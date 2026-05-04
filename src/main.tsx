import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { sampleInput, sampleReport } from "./data/sample";
import { runAudit } from "./services/audit";
import { navigation, useRouter } from "./services/navigation";
import type { AuditInput, AuditReport } from "./types";
import {
  copyShareLink,
  downloadReportPdf,
  loadSavedReport,
  readReportFromHash,
} from "./utils/export";
import { relativeTime } from "./utils/recent";
import type { RecentSearch } from "./utils/recent";
import LandingPage from "./pages/LandingPage";
import ResultsPage from "./pages/ResultsPage";
import "./styles.css";

// ── App Root ──────────────────────────────────────────────────────────────────
function App() {
  const route = useRouter();
  const auditInFlight = useRef(false);

  const [screen, setScreen] = useState<"landing" | "report">(() =>
    route.name === "report" ? "report" : "landing"
  );
  const [loading, setLoading] = useState(() => route.name === "report");
  const [report, setReport] = useState<AuditReport>(() => readReportFromHash() ?? sampleReport);
  const [input, setInput] = useState<AuditInput>(sampleInput);
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  function fetchRecent() {
    fetch("/api/recent")
      .then(r => r.json())
      .then((data: { recent?: Omit<RecentSearch, "time">[] }) => {
        if (data.recent?.length) {
          setRecentSearches(data.recent.map(r => ({ ...r, time: relativeTime(r.createdAt) })));
        }
      })
      .catch(() => {});
  }

  // Initial recent fetch
  useEffect(() => { fetchRecent(); }, []);

  // React to URL route changes (browser back/forward)
  useEffect(() => {
    if (route.name === "landing") {
      setScreen("landing");
      fetchRecent(); // refresh list when returning to landing
      return;
    }

    // route.name === "report"
    if (auditInFlight.current) return; // handleSubmit owns state during an active audit
    if (!loading && report.id === route.reportId) return; // already showing this report

    setScreen("report");
    setLoading(true);
    loadSavedReport(route.reportId)
      .then(r => { setReport(r); setLoading(false); })
      .catch(() => {
        setError("Report could not be loaded.");
        navigation.toLanding();
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  async function handleSubmit(partial: Partial<AuditInput>) {
    const nextInput: AuditInput = { ...sampleInput, ...partial };
    const id = partial.productUrl?.trim()
      ? partial.productUrl.trim()
      : `${partial.brandName ?? ""} – ${partial.productName ?? ""}`.trim();

    setInput(nextInput);
    setIdentifier(id);
    setError("");
    setShareMessage("");

    // Push report URL immediately — loading shows at /?reportId=<temp>
    const tempId = crypto.randomUUID();
    auditInFlight.current = true;
    navigation.toReport(tempId);
    setScreen("report");
    setLoading(true);

    const minWait = new Promise<void>(r => setTimeout(r, 4800));
    try {
      const result = await runAudit(nextInput);
      await minWait;
      setReport(result);
      if (result.id && result.cacheStatus !== "demo") {
        navigation.replaceReport(result.id);
      }
      setLoading(false);
    } catch (err) {
      await minWait;
      setError(err instanceof Error ? err.message : "Audit failed. Try demo mode or check API keys.");
      navigation.toLanding();
      setScreen("landing");
    } finally {
      auditInFlight.current = false;
    }
  }

  async function handleRefresh() {
    setError("");
    setShareMessage("");
    setLoading(true);
    auditInFlight.current = true;

    const minWait = new Promise<void>(r => setTimeout(r, 4800));
    try {
      const result = await runAudit({ ...input, liveMode: true, forceRefresh: true });
      await minWait;
      setReport(result);
      if (result.id && result.cacheStatus !== "demo") {
        navigation.replaceReport(result.id);
      }
      setLoading(false);
    } catch (err) {
      await minWait;
      setError(err instanceof Error ? err.message : "Refresh failed.");
      setLoading(false);
    } finally {
      auditInFlight.current = false;
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

  function handleNewReport() {
    navigation.toLanding();
  }

  async function handleRecentClick(r: RecentSearch) {
    if (r.reportId) {
      setError("");
      setShareMessage("");
      setScreen("report");
      setLoading(true);
      navigation.toReport(r.reportId);
      try {
        const saved = await loadSavedReport(r.reportId);
        setReport(saved);
        setIdentifier(r.url || `${r.brandName ?? ""} – ${r.productName ?? ""}`.trim());
        setLoading(false);
      } catch {
        setError("Report could not be loaded.");
        navigation.toLanding();
        setScreen("landing");
      }
    } else {
      handleSubmit({
        productUrl: r.url || "",
        brandName: r.brandName || "",
        productName: r.productName || r.product,
        targetQuery: r.query,
        liveMode: true,
      });
    }
  }

  return (
    <>
      {screen === "landing" && (
        <LandingPage onSubmit={handleSubmit} onRecentClick={handleRecentClick} error={error} recentSearches={recentSearches} />
      )}
      {screen === "report" && (
        <ResultsPage
          loading={loading}
          report={report}
          identifier={identifier}
          shareMessage={shareMessage}
          onNewReport={handleNewReport}
          onShare={handleShare}
          onExport={() => downloadReportPdf(report)}
          onRefresh={handleRefresh}
        />
      )}
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

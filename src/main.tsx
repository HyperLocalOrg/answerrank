import React, { useEffect, useState } from "react";
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
  readReportIdFromUrl,
} from "./utils/export";
import { loadRecentFromStorage, relativeTime, rememberSearch } from "./utils/recent";
import type { RecentSearch } from "./utils/recent";
import LandingPage from "./pages/LandingPage";
import LoadingPage from "./pages/LoadingPage";
import ResultsPage from "./pages/ResultsPage";
import "./styles.css";

// ── App Root ──────────────────────────────────────────────────────────────────
function App() {
  const route = useRouter();

  const [screen, setScreen] = useState<"landing" | "loading" | "results">(() => {
    if (readReportIdFromUrl()) return "loading";
    const shared = readReportFromHash();
    if (shared) return "results";
    return "landing";
  });
  const [report, setReport] = useState<AuditReport>(() => readReportFromHash() ?? sampleReport);
  const [input, setInput] = useState<AuditInput>(sampleInput);
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(() => loadRecentFromStorage());

  // On mount: load report from URL if present
  useEffect(() => {
    const reportId = readReportIdFromUrl();
    if (reportId) {
      loadSavedReport(reportId)
        .then(r => { setReport(r); setScreen("results"); })
        .catch(() => { setError("Saved report could not be loaded."); setScreen("landing"); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to route changes (back/forward navigation)
  useEffect(() => {
    if (route.name !== "report") {
      // Navigated back to landing
      if (screen === "results") setScreen("landing");
      return;
    }
    // Already have this report loaded — skip refetch
    if (screen === "results" && report.id === route.reportId) return;
    setScreen("loading");
    loadSavedReport(route.reportId)
      .then(r => { setReport(r); setScreen("results"); })
      .catch(() => { setError("Report not found."); navigation.toLanding(); setScreen("landing"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

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
      .catch(() => {/* stay with localStorage */ });
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
      if (result.id && result.cacheStatus !== "demo") {
        navigation.toReport(result.id);
      }
      setScreen("results");
    } catch (err) {
      await minWait;
      setError(err instanceof Error ? err.message : "Audit failed. Try demo mode or check API keys.");
      setScreen("landing");
    }
  }

  async function handleRefresh() {
    setError("");
    setShareMessage("");
    setScreen("loading");
    const minWait = new Promise<void>(r => setTimeout(r, 4800));
    try {
      const result = await runAudit({ ...input, liveMode: true, forceRefresh: true });
      await minWait;
      setReport(result);
      if (result.id && result.cacheStatus !== "demo") {
        navigation.replaceReport(result.id);
      }
      setScreen("results");
    } catch (err) {
      await minWait;
      setError(err instanceof Error ? err.message : "Refresh failed.");
      setScreen("results");
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
    setScreen("landing");
  }

  return (
    <>
      {screen === "landing" && (
        <LandingPage onSubmit={handleSubmit} error={error} recentSearches={recentSearches} />
      )}
      {screen === "loading" && (
        <LoadingPage identifier={identifier} />
      )}
      {screen === "results" && (
        <ResultsPage
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

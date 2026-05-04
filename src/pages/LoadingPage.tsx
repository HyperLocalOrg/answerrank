import { useState, useEffect } from "react";
import Nav from "../components/Nav";
import { IcoSpinner, IcoCheck } from "../components/icons";

const LOADING_MODELS = [
  { name: "GPT-4o", label: "OpenAI" },
  { name: "Gemini", label: "Google" },
  { name: "AI Search", label: "Perplexity / SearchGPT" },
];

export default function LoadingPage({ identifier }: { identifier: string }) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 1000);
    const t2 = setTimeout(() => setStep(2), 2400);
    const t3 = setTimeout(() => setStep(3), 3600);
    let p = 0;
    const iv = setInterval(() => {
      p = Math.min(100, p + 2.2);
      setProgress(p);
      if (p >= 100) clearInterval(iv);
    }, 100);
    return () => { [t1, t2, t3].forEach(clearTimeout); clearInterval(iv); };
  }, []);

  return (
    <div className="ar-loading">
      <Nav hasResult={false} />
      <div className="ar-loading-content ar-fade">
        <div className="ar-card" style={{ padding: "36px 32px", textAlign: "center" }}>
          <div className="ar-loading-icon"><IcoSpinner /></div>
          <h2 className="ar-loading-title">Auditing AI models…</h2>
          <p className="ar-loading-sub">
            Querying models for <strong style={{ color: "#111827" }}>{identifier}</strong>
          </p>
          <div className="ar-progress-track">
            <div className="ar-progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <div className="ar-model-list">
            {LOADING_MODELS.map((m, i) => {
              const done = step > i + 1;
              const active = step === i + 1;
              return (
                <div key={m.name} className={`ar-model-row${done ? " done" : active ? " active" : ""}`}>
                  <div className={`ar-model-dot${done ? " done" : active ? " active" : ""}`}>
                    {done && <IcoCheck size={12} />}
                    {active && <IcoSpinner />}
                    {!done && !active && <span className="ar-dot-inner" />}
                  </div>
                  <div className="ar-model-info">
                    <p className="ar-model-name">{m.name}</p>
                    <p className="ar-model-label">{m.label}</p>
                  </div>
                  <span className={`ar-model-status${done ? " done" : active ? " active" : ""}`}>
                    {done ? "Done" : active ? "Running…" : "Pending"}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="ar-loading-note">This takes ~15 seconds · Cached 12 hours</p>
        </div>
      </div>
    </div>
  );
}

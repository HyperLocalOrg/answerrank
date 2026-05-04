import { navigation } from "../services/navigation";
import { IcoTrophy, IcoShare, IcoDownload, IcoRefresh } from "./icons";

export default function Nav({
  hasResult,
  onNewReport,
  onShare,
  onExport,
  shareMessage,
}: {
  hasResult: boolean;
  onNewReport?: () => void;
  onShare?: () => void;
  onExport?: () => void;
  shareMessage?: string;
}) {
  return (
    <nav className="ar-nav">
      <div className="ar-nav-inner">
        <div
          className="ar-logo"
          style={{ cursor: "pointer" }}
          onClick={() => { navigation.toLanding(); onNewReport?.(); }}
        >
          <div className="ar-logo-icon"><IcoTrophy /></div>
          <span className="ar-logo-text">AnswerRank</span>
        </div>
        {hasResult && (
          <div className="ar-nav-actions">
            {shareMessage && <span className="ar-share-msg">{shareMessage}</span>}
            <button className="ar-btn-ghost" onClick={onShare}><IcoShare /><span>Share</span></button>
            <button className="ar-btn-ghost" onClick={onExport}><IcoDownload /><span>Export</span></button>
            <button className="ar-btn-ghost" onClick={onNewReport}><IcoRefresh /><span>New Report</span></button>
          </div>
        )}
      </div>
    </nav>
  );
}

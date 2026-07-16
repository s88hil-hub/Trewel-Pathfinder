import { Layout, ResearcherNav } from "../components/ui.jsx";
import { useStore } from "../lib/store.jsx";
import { buildDataHandlingSummary, downloadFile } from "../lib/exports.js";

// IRB-readiness panel: what Trewel collects, retention/deletion controls,
// the workspace audit log, and an exportable one-page summary for a
// compliance office. An intentional part of the product, not a disclaimer.
export default function DataHandling() {
  const { data, updateSettings, logAudit, resetDemo } = useStore();
  const retention = data.settings?.retentionDays ?? 90;
  const audit = [...(data.audit || [])].sort((a, b) => b.ts - a.ts);

  function exportSummary() {
    downloadFile("trewel-data-handling-summary.md", buildDataHandlingSummary(data), "text/markdown");
    logAudit("Exported data-handling summary", "Markdown, 1 page");
  }

  function deleteAll() {
    if (confirm("Delete all workspace data and reseed the demo? This clears every study, participant, meal, and audit entry.")) {
      resetDemo();
    }
  }

  return (
    <Layout context="Researcher console" headerRight={<ResearcherNav active="data" />}>
      <div className="section-head">
        <div>
          <h1>Data handling</h1>
          <p className="muted small" style={{ margin: "4px 0 0", maxWidth: 640 }}>
            Everything your IRB or compliance office will ask about, in one place — what Trewel
            collects, how long it keeps it, and who has touched it.
          </p>
        </div>
        <button className="btn" onClick={exportSummary}>Download IRB summary (MD)</button>
      </div>

      <div className="card">
        <div className="card-kicker">What Trewel collects</div>
        <div className="dh-grid" style={{ marginTop: 8 }}>
          <div className="dh-fact"><div className="k">Meal photos</div>Collected — plate only, by instruction</div>
          <div className="dh-fact"><div className="k">Timestamps</div>Collected — local device time</div>
          <div className="dh-fact"><div className="k">AI match results</div>Collected — status, confidence, score</div>
          <div className="dh-fact"><div className="k">Participant notes</div>Optional free text</div>
          <div className="dh-fact"><div className="k">Names / emails</div>Not collected — codes only</div>
          <div className="dh-fact"><div className="k">Location</div>Not collected</div>
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          Participant-facing deviation messages are researcher-pre-authored templates. The AI compares
          meals against the protocol; it never generates its own dietary guidance.
        </p>
      </div>

      <div className="card">
        <div className="card-title-row">
          <div>
            <div className="card-kicker">Retention & deletion</div>
            <h2>How long data is kept</h2>
          </div>
        </div>
        <div className="field" style={{ maxWidth: 380 }}>
          <label htmlFor="retention">Retain study data after study close</label>
          <select id="retention" className="input" value={retention}
            onChange={(e) => updateSettings({ retentionDays: Number(e.target.value) })}>
            <option value={30}>30 days, then delete</option>
            <option value={90}>90 days, then delete</option>
            <option value={180}>180 days, then delete</option>
            <option value={365}>365 days, then delete</option>
          </select>
          <div className="hint">
            Prototype setting — recorded in the audit log and the IRB summary. In production this
            drives automatic deletion under your institution's data-use agreement.
          </div>
        </div>
        <hr className="divider" />
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn--secondary" onClick={deleteAll}>Delete all workspace data now</button>
          <span className="muted small">Clears every study, participant, meal photo, and audit entry, then reseeds the demo.</span>
        </div>
      </div>

      <div className="card">
        <div className="card-title-row">
          <div>
            <div className="card-kicker">Audit log</div>
            <h2>Who did what, when</h2>
          </div>
          <span className="kicker">{audit.length} entries</span>
        </div>
        <div className="table-wrap audit-wrap">
          <table className="data">
            <thead>
              <tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th></tr>
            </thead>
            <tbody>
              {audit.slice(0, 80).map((e) => (
                <tr key={e.id}>
                  <td className="mono muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                    {new Date(e.ts).toLocaleDateString(undefined, { month: "short", day: "numeric" })}{" "}
                    {new Date(e.ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  </td>
                  <td className="mono" style={{ fontSize: 12.5 }}>{e.actor}</td>
                  <td>{e.action}</td>
                  <td className="muted small">{e.target}</td>
                </tr>
              ))}
              {!audit.length ? (
                <tr><td colSpan={4} className="muted" style={{ textAlign: "center", padding: 20 }}>No entries yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          Logged automatically: sign-ins, study creation, enrollment, review decisions, settings
          changes, exports, and deletions.
        </p>
      </div>
    </Layout>
  );
}

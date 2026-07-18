import { Layout, ResearcherNav, useLingo } from "../components/ui.jsx";
import { useWorkspace } from "../lib/store.jsx";
import { buildDataHandlingSummary, downloadFile } from "../lib/exports.js";

// Privacy & compliance panel. Same underlying functionality in both surfaces —
// collection facts, retention/deletion controls, and the audit log. The
// framing switches with the workspace mode: HIPAA-oriented for practitioners,
// IRB-oriented (with the IRB summary export) in Research mode.
export default function DataHandling() {
  const { data, updateSettings, logAudit, resetWorkspace } = useWorkspace();
  const lingo = useLingo();
  const research = data.settings.researchMode;
  const retention = data.settings?.retentionDays ?? 90;
  const audit = [...(data.audit || [])].sort((a, b) => b.ts - a.ts);

  function exportSummary() {
    downloadFile("trewel-data-handling-summary.md", buildDataHandlingSummary(data), "text/markdown");
    logAudit("Exported data-handling summary", "Markdown, 1 page");
  }

  function deleteAll() {
    if (confirm("Delete all workspace data? This clears every plan, client, meal photo, and audit entry.")) {
      resetWorkspace();
    }
  }

  return (
    <Layout context={lingo.console} headerRight={<ResearcherNav active="data" />}>
      <div className="section-head">
        <div>
          <h1>{research ? "Data handling" : "Privacy & compliance"}</h1>
          <p className="muted small" style={{ margin: "4px 0 0", maxWidth: 640 }}>
            {research
              ? "Everything your IRB or compliance office will ask about, in one place — what Trewel collects, how long it keeps it, and who has touched it."
              : "What Trewel collects about your clients, how long it's kept, and a complete log of who accessed what — the questions a HIPAA compliance review asks first."}
          </p>
        </div>
        {research ? (
          <button className="btn" onClick={exportSummary}>Download IRB summary (MD)</button>
        ) : (
          <button className="btn btn--secondary" onClick={exportSummary}>Download data-practices summary</button>
        )}
      </div>

      <div className="card">
        <div className="card-kicker">What Trewel collects</div>
        <div className="dh-grid" style={{ marginTop: 8 }}>
          <div className="dh-fact"><div className="k">Meal photos</div>Collected — plate only, by instruction</div>
          <div className="dh-fact"><div className="k">Timestamps</div>Collected — local device time</div>
          <div className="dh-fact"><div className="k">AI match results</div>Collected — status, confidence, score</div>
          <div className="dh-fact"><div className="k">{lingo.client} notes</div>Optional free text</div>
          <div className="dh-fact"><div className="k">Names / emails</div>Not collected — codes only</div>
          <div className="dh-fact"><div className="k">Location</div>Not collected</div>
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          {lingo.client}-facing deviation messages are practitioner-pre-authored templates. The AI compares
          meals against the plan; it never generates its own dietary guidance.
          {!research
            ? " Identifying clients by code only keeps PHI out of Trewel by design — the code-to-person mapping lives in your own records."
            : ""}
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
          <label htmlFor="retention">Retain {lingo.planLower} data after close</label>
          <select id="retention" className="input" value={retention}
            onChange={(e) => updateSettings({ retentionDays: Number(e.target.value) })}>
            <option value={30}>30 days, then delete</option>
            <option value={90}>90 days, then delete</option>
            <option value={180}>180 days, then delete</option>
            <option value={365}>365 days, then delete</option>
          </select>
          <div className="hint">
            Prototype setting — recorded in the audit log and the exported summary. In production this
            drives automatic deletion under your {research ? "institution's data-use agreement" : "practice's retention policy"}.
          </div>
        </div>
        <hr className="divider" />
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn--secondary" onClick={deleteAll}>Delete all workspace data now</button>
          <span className="muted small">Clears every {lingo.planLower}, {lingo.clientLower}, meal photo, and audit entry.</span>
        </div>
      </div>

      <div className="card">
        <div className="card-title-row">
          <div>
            <div className="card-kicker">{research ? "Audit log" : "Access log"}</div>
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
          Logged automatically: sign-ins, {lingo.planLower} creation, {lingo.clientLower} enrollment, review
          decisions, settings changes, exports, and deletions.
        </p>
      </div>

      {!research ? (
        <p className="muted small" style={{ marginTop: 16 }}>
          Running a formal study? Research mode (IRB summary, REDCap export, data dictionary) can be
          switched on in <a href="/researcher/settings">Settings</a> — nothing is lost by leaving it off.
        </p>
      ) : null}
    </Layout>
  );
}

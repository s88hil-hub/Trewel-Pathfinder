import { Link, useNavigate } from "react-router-dom";
import { Layout, ResearcherNav, useLingo, usePendingCount, practitionerTabs } from "../components/ui.jsx";
import { useWorkspace } from "../lib/store.jsx";
import { useAuth } from "../lib/auth.jsx";

// Practitioner settings: account, and the Research mode toggle that
// reactivates the research-facing surface (terminology, IRB summary,
// REDCap export) — hidden by default, never deleted.
export default function Settings() {
  const { data, updateSettings } = useWorkspace();
  const { user, logout } = useAuth();
  const lingo = useLingo();
  const pending = usePendingCount();
  const navigate = useNavigate();
  const research = data.settings.researchMode;

  function signOut() {
    logout();
    navigate("/");
  }

  return (
    <Layout narrow context={lingo.console} headerRight={<ResearcherNav active="settings" />}
      tabs={practitionerTabs(lingo, pending)}>
      <h1>Settings</h1>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-kicker">Account</div>
        <div className="toggle-row">
          <div>
            <div style={{ fontWeight: 600 }}>{user?.name}</div>
            <div className="muted small mono">{user?.email}</div>
          </div>
          <button className="btn btn--secondary btn--small" onClick={signOut}>Sign out</button>
        </div>
        <p className="muted small" style={{ margin: "10px 0 0" }}>
          Your plans, clients, and meal logs are saved to this account and restored when you sign back in.
        </p>
      </div>

      <Link to="/researcher/data-handling" className="plan-row" style={{ marginTop: 18 }}>
        <div className="pr-main">
          <div className="pr-name" style={{ fontSize: 16 }}>{lingo.privacy}</div>
          <div className="pr-desc">
            What Trewel collects, retention &amp; deletion, and the full access log —
            {research ? " plus your IRB-readiness summary and REDCap export." : " the questions a HIPAA review asks first."}
          </div>
        </div>
        <span className="ai-arrow" aria-hidden="true">→</span>
      </Link>

      <div className="card">
        <div className="card-kicker">Surfaces</div>
        <div className="toggle-row">
          <div style={{ maxWidth: 480 }}>
            <div style={{ fontWeight: 600 }}>Research mode</div>
            <p className="muted small" style={{ margin: "4px 0 0" }}>
              Switches the console to research terminology (studies, participants) and reactivates the
              research toolset: IRB-readiness summary, REDCap export, and the data dictionary. All of it
              stays intact while hidden — turning this off loses nothing.
            </p>
          </div>
          <button
            className={research ? "btn btn--small" : "btn btn--secondary btn--small"}
            aria-pressed={research}
            onClick={() => updateSettings({ researchMode: !research })}>
            {research ? "On" : "Off"}
          </button>
        </div>
        <div className="toggle-row">
          <div style={{ maxWidth: 480 }}>
            <div style={{ fontWeight: 600 }}>EHR / practice-management integrations</div>
            <p className="muted small" style={{ margin: "4px 0 0" }}>
              Push adherence summaries into your charting workflow. Not available yet — planned.
            </p>
          </div>
          <button className="btn btn--secondary btn--small" disabled>Coming soon</button>
        </div>
      </div>
    </Layout>
  );
}

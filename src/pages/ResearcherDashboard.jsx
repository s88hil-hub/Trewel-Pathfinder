import { Link } from "react-router-dom";
import { Layout, StatusPill, ResearcherNav, SplitMeter } from "../components/ui.jsx";
import { Sparkline } from "../components/charts.jsx";
import { useStore } from "../lib/store.jsx";
import { adherenceFlag, currentAdherence, dailySeries, reviewStats } from "../lib/adherence.js";

export default function ResearcherDashboard() {
  const { data } = useStore();
  const studies = Object.values(data.studies).sort((a, b) => b.createdAt - a.createdAt);
  const allMeals = Object.values(data.participants).flatMap((p) => p.meals);
  const stats = reviewStats(allMeals);

  return (
    <Layout context="Researcher console" headerRight={<ResearcherNav active="studies" />}>
      <div className="section-head">
        <div>
          <h1>Studies</h1>
          <p className="muted small" style={{ margin: "4px 0 0" }}>
            Adherence is the rolling 7-day average of verified meal-match scores (0–100).
          </p>
        </div>
        <Link to="/researcher/studies/new" className="btn">+ Create study</Link>
      </div>

      {/* Verification transparency — the system knows its own limits */}
      <div className="stat-row" style={{ marginBottom: 22 }}>
        <div className="stat-tile">
          <div className="stat-label">Meals analyzed</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-tile" style={{ gridColumn: "span 2" }}>
          <div className="stat-label">Verification transparency</div>
          <div style={{ fontSize: 14.5, marginTop: 2 }}>
            <strong className="mono">{stats.autoPct}%</strong> auto-verified ·{" "}
            <strong className="mono">{stats.flaggedPct}%</strong> routed to human review
          </div>
          <SplitMeter a={stats.autoPct} b={stats.flaggedPct} aLabel="Auto-verified" bLabel="Human-reviewed" />
        </div>
        <div className="stat-tile">
          <div className="stat-label">Awaiting review</div>
          <div className="stat-value">{stats.pending}</div>
          <div style={{ marginTop: 6 }}>
            {stats.pending > 0
              ? <Link to="/researcher/review" className="small" style={{ fontWeight: 600 }}>Open review queue →</Link>
              : <span className="muted small">Queue clear</span>}
          </div>
        </div>
      </div>

      {studies.map((study) => {
        const participants = study.participants.map((c) => data.participants[c]).filter(Boolean);
        const scores = participants.map((p) => currentAdherence(p.meals)).filter((s) => s != null);
        const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
        const flagged = participants.filter((p) => {
          const f = adherenceFlag(p.meals);
          return f.level === "critical" || f.level === "serious";
        }).length;
        const studyMeals = participants.flatMap((p) => p.meals);
        return (
          <div key={study.id} className="card">
            <div className="card-title-row">
              <div>
                <h2><Link to={`/researcher/studies/${study.id}`}>{study.name}</Link></h2>
                <p className="muted small" style={{ margin: "4px 0 0", maxWidth: 640 }}>{study.description}</p>
              </div>
              <Link className="btn btn--secondary" to={`/researcher/studies/${study.id}`}>Open study</Link>
            </div>
            <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
              <Metric label="Participants" value={participants.length} />
              <Metric label="Meals logged" value={studyMeals.length} />
              <Metric label="Mean adherence (7d)" value={avg != null ? avg : "—"} />
              <div>
                <div className="stat-label">Study trend (14d)</div>
                <Sparkline series={dailySeries(studyMeals, 14)} width={140} height={34} />
              </div>
              <div>
                <div className="stat-label">Flags</div>
                {flagged > 0
                  ? <StatusPill level="serious" label={`${flagged} participant${flagged === 1 ? "" : "s"} off-protocol / trending off`} />
                  : <StatusPill level="good" label="No active flags" />}
              </div>
            </div>
          </div>
        );
      })}

      {!studies.length ? <div className="empty">No studies yet. Create your first study to begin.</div> : null}
    </Layout>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

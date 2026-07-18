import { Link, useParams } from "react-router-dom";
import { Layout, StatusPill, MealCard, StatTile, ResearcherNav, useLingo, usePendingCount, practitionerTabs } from "../components/ui.jsx";
import { AdherenceLineChart, WeeklyBars } from "../components/charts.jsx";
import { useWorkspace } from "../lib/store.jsx";
import { adherenceFlag, dailySeries, weeklyRollup } from "../lib/adherence.js";

// Researcher view of a single participant: meal-by-meal log with photos
// and match results, plus daily/weekly adherence rollups.
export default function ParticipantDetail() {
  const { id, code } = useParams();
  const { data } = useWorkspace();
  const lingo = useLingo();
  const pending = usePendingCount();
  const study = data.studies[id];
  const participant = data.participants[code];

  if (!study || !participant) {
    return (
      <Layout context={lingo.console}>
        <div className="empty">{lingo.client} not found. <Link to="/researcher/dashboard">Back to {lingo.plansLower}</Link></div>
      </Layout>
    );
  }

  const flag = adherenceFlag(participant.meals);
  const meals = [...participant.meals].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <Layout context={lingo.console} headerRight={<ResearcherNav />} tabs={practitionerTabs(lingo, pending)}>
      <div className="section-head">
        <div>
          <div className="card-kicker"><Link to={`/researcher/studies/${id}`}>← {study.name}</Link></div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="code-chip" style={{ fontSize: 18, padding: "4px 12px" }}>{participant.code}</span>
            <StatusPill level={flag.level} label={flag.label} />
          </h1>
        </div>
      </div>

      <div className="stat-row">
        <StatTile label="Adherence (7-day rolling)" value={flag.score ?? "—"} delta={flag.delta} deltaLabel="last 3d vs prior 4d" />
        <StatTile label="Meals logged" value={participant.meals.length} />
        <StatTile label="Enrolled" value={new Date(participant.joinedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
      </div>

      <div className="card">
        <div className="card-title-row">
          <h2>Daily adherence</h2>
          <span className="muted small">Mean meal score per day, last 14 days</span>
        </div>
        <AdherenceLineChart series={dailySeries(participant.meals, 14)} />
      </div>

      <div className="card">
        <div className="card-title-row">
          <h2>Weekly rollup</h2>
          <span className="muted small">Mean meal score per week</span>
        </div>
        <WeeklyBars weeks={weeklyRollup(participant.meals, 4)} />
      </div>

      <div className="section-head">
        <h2>Meal log</h2>
        <span className="muted small">{meals.length} meals · newest first</span>
      </div>
      <div className="meal-list">
        {meals.map((m) => <MealCard key={m.id} meal={m} code={participant.code} />)}
        {!meals.length ? <div className="empty">No meals logged yet.</div> : null}
      </div>
    </Layout>
  );
}

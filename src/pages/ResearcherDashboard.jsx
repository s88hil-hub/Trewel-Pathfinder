import { Link } from "react-router-dom";
import { Layout, StatusPill, ResearcherNav, SplitMeter, useLingo } from "../components/ui.jsx";
import { Sparkline } from "../components/charts.jsx";
import { useWorkspace } from "../lib/store.jsx";
import { useAuth } from "../lib/auth.jsx";
import { adherenceFlag, currentAdherence, dailySeries, reviewStats } from "../lib/adherence.js";

export default function ResearcherDashboard() {
  const { data, loadSample } = useWorkspace();
  const { user } = useAuth();
  const lingo = useLingo();
  const studies = Object.values(data.studies).sort((a, b) => b.createdAt - a.createdAt);
  const participants = Object.values(data.participants);
  const allMeals = participants.flatMap((p) => p.meals);
  const stats = reviewStats(allMeals);

  // "3 of 5 clients on track this week" — adherence to plan, not nutrient totals.
  const withData = participants.map((p) => adherenceFlag(p.meals)).filter((f) => f.level !== "nodata");
  const onTrack = withData.filter((f) => f.level === "good").length;

  const isEmpty = studies.length === 0;
  const anyRealMeal = allMeals.some((m) => m.photo);

  return (
    <Layout context={lingo.console} headerRight={<ResearcherNav active="studies" />}>
      <div className="section-head">
        <div>
          <h1>{lingo.plans}</h1>
          <p className="muted small" style={{ margin: "4px 0 0" }}>
            {isEmpty
              ? `Welcome, ${user?.name || "practitioner"}.`
              : withData.length > 0
                ? <><strong className="mono">{onTrack} of {withData.length}</strong> {onTrack === 1 && withData.length === 1 ? lingo.clientLower : lingo.clientsLower} on track this week · adherence is the rolling 7-day average of verified meal-match scores (0–100).</>
                : "Adherence is the rolling 7-day average of verified meal-match scores (0–100)."}
          </p>
        </div>
        <Link to="/researcher/studies/new" className="btn">+ Create {lingo.planLower}</Link>
      </div>

      {isEmpty ? (
        <FirstRunChecklist lingo={lingo} loadSample={loadSample} />
      ) : (
        <>
          {/* Verification transparency — the system knows its own limits */}
          <div className="stat-row" style={{ marginBottom: 22 }}>
            <div className="stat-tile">
              <div className="stat-label">{lingo.clients} on track</div>
              <div className="stat-value">{withData.length ? `${onTrack}/${withData.length}` : "—"}</div>
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
            const studyParticipants = study.participants.map((c) => data.participants[c]).filter(Boolean);
            const scores = studyParticipants.map((p) => currentAdherence(p.meals)).filter((s) => s != null);
            const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
            const flagged = studyParticipants.filter((p) => {
              const f = adherenceFlag(p.meals);
              return f.level === "critical" || f.level === "serious";
            }).length;
            const studyMeals = studyParticipants.flatMap((p) => p.meals);
            return (
              <div key={study.id} className="card">
                <div className="card-title-row">
                  <div>
                    <h2><Link to={`/researcher/studies/${study.id}`}>{study.name}</Link></h2>
                    <p className="muted small" style={{ margin: "4px 0 0", maxWidth: 640 }}>{study.description}</p>
                  </div>
                  <Link className="btn btn--secondary" to={`/researcher/studies/${study.id}`}>Open {lingo.planLower}</Link>
                </div>
                <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
                  <Metric label={lingo.clients} value={studyParticipants.length} />
                  <Metric label="Meals logged" value={studyMeals.length} />
                  <Metric label="Mean adherence (7d)" value={avg != null ? avg : "—"} />
                  <div>
                    <div className="stat-label">Trend (14d)</div>
                    <Sparkline series={dailySeries(studyMeals, 14)} width={140} height={34} />
                  </div>
                  <div>
                    <div className="stat-label">Flags</div>
                    {flagged > 0
                      ? <StatusPill level="serious" label={`${flagged} ${flagged === 1 ? lingo.clientLower : lingo.clientsLower} off-plan / trending off`} />
                      : <StatusPill level="good" label="No active flags" />}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
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

/* ------------------------------------------------------------------ */
/* Self-serve first run: plan → invite → first verified meal.          */
/* ------------------------------------------------------------------ */
function FirstRunChecklist({ lingo, loadSample }) {
  return (
    <>
      <div className="card">
        <div className="card-kicker">Getting started</div>
        <h2 style={{ marginBottom: 4 }}>Your first {lingo.clientLower}, in three steps</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          Trewel checks whether your {lingo.clientLower} followed their plan — not just what they ate.
          Every meal photo is checked rule by rule against the plan you define here.
        </p>
        <div className="onboard-steps">
          <div className="onboard-step">
            <span className="onboard-num">1</span>
            <div>
              <div className="onboard-label">
                <Link to="/researcher/studies/new">Create your first {lingo.planLower}</Link>
              </div>
              <div className="onboard-hint">
                Start from a condition template (diabetes, hypertension, low-FODMAP…) or build your own rules.
              </div>
            </div>
          </div>
          <div className="onboard-step">
            <span className="onboard-num">2</span>
            <div>
              <div className="onboard-label">Invite your {lingo.clientLower}</div>
              <div className="onboard-hint">
                Open the {lingo.planLower} and generate an invite code — no name or email needed, the code is
                their whole login.
              </div>
            </div>
          </div>
          <div className="onboard-step">
            <span className="onboard-num">3</span>
            <div>
              <div className="onboard-label">Watch the first meal get checked</div>
              <div className="onboard-hint">
                Your {lingo.clientLower} photographs a plate; you see the rule-by-rule verdict here within
                seconds — with anything uncertain routed to you for review.
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="empty" style={{ marginTop: 18 }}>
        Want to look around first?{" "}
        <button className="btn btn--ghost" onClick={() => { if (confirm("Load the sample workspace? This fills your (currently empty) workspace with example plans, clients, and meal logs.")) loadSample(); }}>
          Load a sample workspace
        </button>
      </div>
    </>
  );
}

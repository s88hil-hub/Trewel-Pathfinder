import { Link } from "react-router-dom";
import { Layout, StatusPill, ResearcherNav, useLingo, usePendingCount, practitionerTabs } from "../components/ui.jsx";
import { useWorkspace } from "../lib/store.jsx";
import { useAuth } from "../lib/auth.jsx";
import { adherenceFlag, currentAdherence, reviewStats } from "../lib/adherence.js";

export default function ResearcherDashboard() {
  const { data, loadSample } = useWorkspace();
  const { user } = useAuth();
  const lingo = useLingo();
  const pending = usePendingCount();
  const studies = Object.values(data.studies).sort((a, b) => b.createdAt - a.createdAt);
  const participants = Object.values(data.participants);
  const allMeals = participants.flatMap((p) => p.meals);
  const stats = reviewStats(allMeals);

  // "3 of 5 clients on track this week" — adherence to plan, not nutrient totals.
  const flags = participants.map((p) => ({ p, flag: adherenceFlag(p.meals) }));
  const withData = flags.filter((f) => f.flag.level !== "nodata");
  const onTrack = withData.filter((f) => f.flag.level === "good").length;

  // The single most important thing: who needs attention right now.
  const needsAttention = flags
    .filter((f) => f.flag.level === "critical" || f.flag.level === "serious")
    .sort((a, b) => (a.flag.score ?? 999) - (b.flag.score ?? 999));

  const isEmpty = studies.length === 0;

  return (
    <Layout context={lingo.console} headerRight={<ResearcherNav active="studies" />}
      tabs={practitionerTabs(lingo, pending)}>
      <div className="section-head">
        <div>
          <h1>{lingo.plans}</h1>
          <p className="muted small" style={{ margin: "4px 0 0" }}>
            {isEmpty
              ? `Welcome, ${user?.name || "practitioner"}.`
              : <>Signed in as {user?.name}. Adherence is the rolling 7-day average of verified meal-match scores.</>}
          </p>
        </div>
        <Link to="/researcher/studies/new" className="btn">+ Create {lingo.planLower}</Link>
      </div>

      {isEmpty ? (
        <FirstRunChecklist lingo={lingo} loadSample={loadSample} />
      ) : (
        <>
          {/* THE HERO: who needs attention right now */}
          <AttentionHero
            needsAttention={needsAttention}
            pending={pending}
            studies={data.studies}
            lingo={lingo}
          />

          {/* Secondary at-a-glance figures, condensed */}
          <div className="mini-stats">
            <div className="mini-stat">
              <div className="k">{lingo.clients} on track</div>
              <div className="v">{withData.length ? `${onTrack}/${withData.length}` : "—"}</div>
            </div>
            <div className="mini-stat">
              <div className="k">Auto-verified</div>
              <div className="v">{stats.autoPct}%</div>
            </div>
            <div className="mini-stat">
              <div className="k">Awaiting review</div>
              <div className="v">{stats.pending}</div>
            </div>
          </div>

          {/* Plans — one calm row each; detail lives a click away */}
          <div className="section-head" style={{ marginBottom: 12 }}>
            <h2>Your {lingo.plansLower}</h2>
            <span className="muted small">{studies.length} active</span>
          </div>
          {studies.map((study) => {
            const studyParticipants = study.participants.map((c) => data.participants[c]).filter(Boolean);
            const scores = studyParticipants.map((p) => currentAdherence(p.meals)).filter((s) => s != null);
            const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
            const flagged = studyParticipants.filter((p) => {
              const f = adherenceFlag(p.meals);
              return f.level === "critical" || f.level === "serious";
            }).length;
            return (
              <Link key={study.id} to={`/researcher/studies/${study.id}`} className="plan-row">
                <div className="pr-main">
                  <div className="pr-name">{study.name}</div>
                  {study.description ? <div className="pr-desc">{study.description}</div> : null}
                </div>
                <Metric label={lingo.clients} value={studyParticipants.length} />
                <Metric label="Adherence" value={avg != null ? avg : "—"} />
                <div style={{ minWidth: 128 }}>
                  <div className="stat-label">Status</div>
                  {flagged > 0
                    ? <StatusPill level="serious" label={`${flagged} need${flagged === 1 ? "s" : ""} attention`} />
                    : <StatusPill level="good" label="All on track" />}
                </div>
              </Link>
            );
          })}
        </>
      )}
    </Layout>
  );
}

/* ------------------------------------------------------------------ */
/* Attention hero — the dominant, immediately-visible element. Three    */
/* states: someone off-plan (urgent), reviews waiting (calm), or clear. */
/* ------------------------------------------------------------------ */
function AttentionHero({ needsAttention, pending, studies, lingo }) {
  const count = needsAttention.length;

  // State 1 — nobody off-plan, nothing to review: all clear.
  if (count === 0 && pending === 0) {
    return (
      <div className="attention attention--clear">
        <div className="attention-head">
          <span className="attention-count attention-count--clear">✓</span>
          <div>
            <h2 style={{ margin: 0 }}>Everyone's on track</h2>
            <div className="attention-sub">No {lingo.clientsLower} are off-plan and nothing is waiting for review.</div>
          </div>
        </div>
      </div>
    );
  }

  // State 2 — nobody off-plan, but meals are waiting for review: calm, not red.
  if (count === 0) {
    return (
      <div className="attention attention--clear">
        <div className="attention-head">
          <span className="attention-count attention-count--clear">{pending}</span>
          <div>
            <h2 style={{ margin: 0 }}>{pending} meal{pending === 1 ? "" : "s"} to review</h2>
            <div className="attention-sub">
              No {lingo.clientsLower} are off-plan. The AI wasn't sure about {pending === 1 ? "one meal" : "these"} —{" "}
              <Link to="/researcher/review" style={{ fontWeight: 600 }}>confirm or correct →</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // State 3 — someone is off-plan: urgent, list them.
  return (
    <div className="attention attention--flagged">
      <div className="attention-head">
        <span className="attention-count attention-count--flagged">{count}</span>
        <div>
          <h2 style={{ margin: 0 }}>
            {count} {count === 1 ? lingo.clientLower : lingo.clientsLower} need{count === 1 ? "s" : ""} attention
          </h2>
          <div className="attention-sub">
            Off-plan or trending off-plan this week — worth a look.
            {pending > 0 ? (
              <> · <Link to="/researcher/review" style={{ fontWeight: 600 }}>{pending} meal{pending === 1 ? "" : "s"} awaiting review →</Link></>
            ) : null}
          </div>
        </div>
      </div>

      <div className="attention-list">
        {needsAttention.slice(0, 5).map(({ p, flag }) => {
          const study = studies[p.studyId];
          return (
            <Link key={p.code} className="attention-item"
              to={`/researcher/studies/${p.studyId}/participants/${p.code}`}>
              <div>
                <div className="ai-code">{p.code}</div>
                <div className="ai-plan">{study?.name || "—"}</div>
              </div>
              <span className="header-spacer" />
              <StatusPill level={flag.level} label={flag.label} />
              <span className="ai-arrow" aria-hidden="true">→</span>
            </Link>
          );
        })}
        {count > 5 ? (
          <div className="muted small" style={{ padding: "4px 4px 0" }}>+{count - 5} more across your {lingo.plansLower}.</div>
        ) : null}
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div style={{ minWidth: 74 }}>
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

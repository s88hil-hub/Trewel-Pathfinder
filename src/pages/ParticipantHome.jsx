import { Link, useParams } from "react-router-dom";
import { Layout, MealCard, StatTile } from "../components/ui.jsx";
import { AdherenceLineChart } from "../components/charts.jsx";
import { useParticipantLookup } from "../lib/store.jsx";
import { teamLabelForStudy } from "../lib/lingo.js";
import { currentAdherence, dailySeries, trendDelta, weekSummary, dayKey, mealIsPending } from "../lib/adherence.js";
import { findResponseTemplate } from "../lib/protocolTemplates.js";

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Randomized (but stable per code+day) reminder times inside normal meal
// windows — participants shouldn't be able to "perform" compliance only when
// they expect a check-in.
function reminderTimes(code) {
  const h = hashString(code + dayKey(Date.now()));
  const windows = [
    { start: 7 * 60, span: 150 },   // breakfast 7:00–9:30
    { start: 11.5 * 60, span: 150 },// lunch 11:30–14:00
    { start: 17.5 * 60, span: 180 },// dinner 17:30–20:30
  ];
  return windows.map((w, i) => {
    const mins = w.start + ((h >> (i * 7)) % w.span);
    const d = new Date();
    d.setHours(Math.floor(mins / 60), Math.round(mins % 60), 0, 0);
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  });
}

export default function ParticipantHome() {
  const { code } = useParams();
  const lookup = useParticipantLookup(code);
  const participant = lookup?.participant;
  const study = lookup?.study;
  const team = teamLabelForStudy(study);

  if (!participant || !study) {
    return (
      <Layout narrow context="Participant">
        <div className="empty" style={{ marginTop: 48 }}>
          That code didn't match an active plan. <Link to="/participant">Enter your code</Link>
        </div>
      </Layout>
    );
  }

  const p = study.protocol;
  const score = currentAdherence(participant.meals);
  const delta = trendDelta(participant.meals);
  const week = weekSummary(participant.meals);
  const weekDays = dailySeries(participant.meals, 7);
  const meals = [...participant.meals].sort((a, b) => b.timestamp - a.timestamp).slice(0, 12);
  const reminders = reminderTimes(code);

  return (
    <Layout narrow context={<>Client · <span className="code-chip">{participant.code}</span></>}
      headerRight={<Link className="header-link" to="/participant">Switch code</Link>}>

      <div className="section-head">
        <div>
          <div className="card-kicker">{study.name}</div>
          <h1>{study.surface === "research" ? "Your study dashboard" : "Your plan"}</h1>
        </div>
        <Link to={`/participant/${code}/log`} className="btn btn--lg">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="1.5" y="4" width="13" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M5.5 4l1-2h3l1 2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <circle cx="8" cy="9" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          Log a meal
        </Link>
      </div>

      <div className="stat-row">
        <StatTile label="Your adherence (7-day)" value={score ?? "—"} delta={delta} deltaLabel="recent trend" />
        <StatTile label="Meals logged" value={participant.meals.length} />
      </div>

      {/* Your week — reflective, your own data, never prescriptive */}
      <div className="card">
        <div className="card-title-row" style={{ marginBottom: 4 }}>
          <h2>Your week</h2>
          <span className="muted small">Last 7 days</span>
        </div>
        <p style={{ margin: "2px 0 0", fontSize: 15 }}>
          {week.daysLogged === 0
            ? "No meals logged in the last 7 days yet — your week starts with the next photo."
            : <>You were on-plan <strong className="mono">{week.onDays} of {week.daysLogged}</strong> logged
              days this week, across <strong className="mono">{week.mealCount}</strong> meals.</>}
          {week.pendingCount > 0 ? (
            <span className="muted"> {week.pendingCount} recent {week.pendingCount === 1 ? "meal is" : "meals are"} with {team} for a quick confirmation — {week.pendingCount === 1 ? "it doesn't" : "they don't"} affect your score yet.</span>
          ) : null}
        </p>
        <div className="week-days" aria-hidden="true">
          {weekDays.map((d) => (
            <div key={d.key} className="week-day"
              style={{
                "--fill": d.score == null ? "0%" : `${d.score}%`,
                "--day-color": d.score == null ? "var(--rule)" : d.score >= 80 ? "var(--accent)" : d.score >= 65 ? "var(--deviation)" : "var(--off)",
              }}>
              {d.label.split(" ")[1]}
            </div>
          ))}
        </div>
        <p className="muted small" style={{ margin: "10px 0 0" }}>
          {study.surface === "research"
            ? "Complete logging is what makes your study's data trustworthy — days you log matter more than days that look perfect."
            : "Days you log matter more than days that look perfect — the full picture is what lets " + team + " adjust the plan with you."}
        </p>
      </div>

      <div className="card">
        <div className="card-title-row" style={{ marginBottom: 4 }}>
          <h2>Today's check-in times</h2>
        </div>
        <div className="reminder-times">
          {reminders.map((t) => <span key={t} className="reminder-time">{t}</span>)}
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          These shift a little each day within your usual meal windows, so your log reflects how you
          actually eat rather than scheduled check-ins. Logging outside these times is always fine.
        </p>
      </div>

      <div className="card">
        <div className="card-title-row">
          <h2>{study.surface === "research" ? "Your assigned protocol" : "Your plan, in plain language"}</h2>
        </div>
        <p style={{ marginTop: 0, fontSize: 15 }}>{p.summary}</p>
        <div className="protocol-grid">
          {p.emphasize?.length ? (
            <div className="protocol-item"><div className="k">Build meals around</div><div className="v">{p.emphasize.join(", ")}</div></div>
          ) : null}
          {p.limit?.length ? (
            <div className="protocol-item"><div className="k">Keep to a minimum</div><div className="v">{p.limit.join(", ")}</div></div>
          ) : null}
          {p.excludedFoods?.length ? (
            <div className="protocol-item"><div className="k">{study.surface === "research" ? "Not part of this study" : "Not part of your plan"}</div><div className="v">{p.excludedFoods.join(", ")}</div></div>
          ) : null}
          {p.sodiumLimitMg ? (
            <div className="protocol-item"><div className="k">Salt / sodium</div><div className="v">Aim under {p.sodiumLimitMg} mg per meal — watch cured meats, canned and fast food</div></div>
          ) : null}
        </div>
        {p.notes ? <p className="muted small" style={{ marginBottom: 0 }}>{p.notes}</p> : null}
      </div>

      <div className="card">
        <div className="card-title-row">
          <h2>Your adherence trend</h2>
          <span className="muted small">Last 14 days</span>
        </div>
        <AdherenceLineChart series={dailySeries(participant.meals, 14)} height={190} />
      </div>

      <div className="section-head">
        <h2>Recent meals</h2>
        <span className="muted small">{participant.meals.length} total</span>
      </div>
      <div className="meal-list">
        {meals.map((m) => (
          <MealCard key={m.id} meal={m} code={participant.code}
            teamMessage={!mealIsPending(m) ? findResponseTemplate(p, m.result)?.message : null}
            teamFrom={team} />
        ))}
        {!meals.length ? (
          <div className="empty">
            Nothing logged yet. <Link to={`/participant/${code}/log`}>Log your first meal</Link> — it takes
            one photo.
          </div>
        ) : null}
      </div>
    </Layout>
  );
}

import { Link, useNavigate } from "react-router-dom";
import { STATUS_META, CONFIDENCE_META, mealIsPending } from "../lib/adherence.js";
import { SpecimenPhoto } from "./verification.jsx";
import { useStore } from "../lib/store.jsx";

/* ------------------------------------------------------------------ */
/* Reticle glyph — a registration mark: the emblem of verification     */
/* ------------------------------------------------------------------ */
export function Reticle({ size = 22, color = "var(--accent)" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="10.5" fill="none" stroke={color} strokeWidth="2" />
      <path d="M16 1.5v8M16 22.5v8M1.5 16h8M22.5 16h8" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.4" fill={color} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Wordmark                                                            */
/* ------------------------------------------------------------------ */
export function Wordmark({ sub }) {
  return (
    <Link to="/" className="wordmark" aria-label="Trewel home">
      <Reticle />
      <span>
        <span className="wordmark-text">Trewel</span>
        {sub ? <span className="wordmark-sub">{sub}</span> : null}
      </span>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Researcher navigation — consistent across the console               */
/* ------------------------------------------------------------------ */
export function ResearcherNav({ active }) {
  const { data } = useStore();
  const navigate = useNavigate();
  const pending = Object.values(data.participants).reduce(
    (n, p) => n + p.meals.filter(mealIsPending).length, 0
  );
  const cls = (k) => `header-link${active === k ? " header-link--active" : ""}`;
  function signOut() {
    sessionStorage.removeItem("trewel-researcher");
    sessionStorage.removeItem("trewel-researcher-email");
    navigate("/");
  }
  return (
    <nav className="header-nav" aria-label="Researcher console">
      <Link className={cls("studies")} to="/researcher/dashboard">Studies</Link>
      <Link className={cls("review")} to="/researcher/review">
        Review queue{pending > 0 ? <span className="nav-badge">{pending}</span> : null}
      </Link>
      <Link className={cls("data")} to="/researcher/data-handling">Data handling</Link>
      <button className="btn btn--ghost" style={{ fontSize: 13.5 }} onClick={signOut}>Sign out</button>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Page chrome                                                         */
/* ------------------------------------------------------------------ */
export function Layout({ context, headerRight, narrow, children }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <Wordmark />
          {context ? <span className="header-context">{context}</span> : null}
          <span className="header-spacer" />
          {headerRight}
        </div>
      </header>
      <main className={`app-main${narrow ? " app-main--narrow" : ""}`}>{children}</main>
      <DataHandlingFooter />
    </div>
  );
}

export function DataHandlingFooter() {
  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <svg className="footer-glyph" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 1.5l5.5 2.2v3.4c0 3.4-2.3 6.1-5.5 7.4C4.8 13.2 2.5 10.5 2.5 7.1V3.7L8 1.5z" fill="none" stroke="var(--ink-muted)" strokeWidth="1.3" />
          <path d="M5.6 8l1.7 1.7L10.6 6" fill="none" stroke="var(--ink-muted)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>
          <strong>Data handling.</strong> Trewel is a research prototype. All study data — including meal
          photos — stays in this browser for demonstration and is transmitted only for automated meal
          analysis. Running an actual trial on Trewel requires IRB approval and institutional data-use
          agreements covering photo capture, storage, and retention. Automated assessments support research
          logging only; they are not medical or dietary advice.
        </span>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Status pill — icon + label always (color never carries meaning alone) */
/* ------------------------------------------------------------------ */
const PILL_ICONS = {
  good: (
    <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 8.2l2 2L11 6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  warning: (
    <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2l6.5 11.4H1.5L8 2z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 6.4v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="8" cy="11.4" r="0.9" fill="currentColor" />
    </svg>
  ),
  serious: (
    <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 5.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  critical: (
    <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  pending: (
    <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 4.6V8l2.4 1.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  nodata: (
    <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 8h8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  ),
};

export function StatusPill({ level, label }) {
  const cls =
    level === "good" ? "pill--good"
    : level === "warning" ? "pill--warning"
    : level === "serious" ? "pill--serious"
    : level === "critical" ? "pill--critical"
    : level === "pending" ? "pill--pending"
    : "pill--neutral";
  return (
    <span className={`pill ${cls}`}>
      {PILL_ICONS[level] || PILL_ICONS.nodata}
      {label}
    </span>
  );
}

export function MatchPill({ status }) {
  const meta = STATUS_META[status] || { label: status, level: "nodata" };
  return <StatusPill level={meta.level} label={meta.label} />;
}

/* Confidence — dots + label, deliberately neutral ink (confidence is a
   property of the measurement, not a verdict). */
export function ConfidencePill({ level }) {
  const meta = CONFIDENCE_META[level];
  if (!meta) return null;
  const dots = "●".repeat(meta.dots) + "○".repeat(3 - meta.dots);
  return (
    <span className="pill pill--conf" aria-label={meta.label} title={meta.label}>
      <span aria-hidden="true" style={{ letterSpacing: "0.1em" }}>{dots}</span>
      {level} conf
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Stat readout                                                        */
/* ------------------------------------------------------------------ */
export function StatTile({ label, value, delta, deltaLabel, children }) {
  let deltaEl = null;
  if (delta != null) {
    const dir = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "—";
    deltaEl = (
      <div className={`stat-delta stat-delta--${dir}`}>
        {arrow} {Math.abs(delta)} pts {deltaLabel || ""}
      </div>
    );
  }
  return (
    <div className="stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {deltaEl}
      {children}
    </div>
  );
}

/* Split meter — two-segment proportion bar (auto-verified vs reviewed) */
export function SplitMeter({ a, b, aLabel, bLabel }) {
  const total = a + b || 1;
  return (
    <div className="split-meter" role="img" aria-label={`${aLabel}: ${a}%. ${bLabel}: ${b}%.`}>
      <div className="split-meter-bar">
        <span style={{ width: `${(a / total) * 100}%`, background: "var(--accent)" }} />
        <span style={{ width: `${(b / total) * 100}%`, background: "var(--deviation)" }} />
      </div>
      <div className="split-meter-legend">
        <span><i style={{ background: "var(--accent)" }} /> {aLabel}</span>
        <span><i style={{ background: "var(--deviation)" }} /> {bLabel}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Placeholder plate for seeded meals (no photo stored)                */
/* ------------------------------------------------------------------ */
export function PlatePlaceholder({ seed = 0, size = "100%" }) {
  const hues = [
    ["#bcd6cf", "#136f63"],
    ["#e3d3ae", "#9a6200"],
    ["#d4dbc8", "#5a7a4a"],
  ];
  const [light, dark] = hues[Math.abs(seed) % hues.length];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="No photo stored for this seeded meal"
      style={{ display: "block", background: "var(--surface-bright)" }}>
      <circle cx="32" cy="32" r="25" fill="#fff" stroke="var(--rule-strong)" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="16.5" fill="none" stroke="var(--rule)" strokeWidth="1.2" />
      <circle cx="26" cy="29" r="6" fill={light} />
      <circle cx="38" cy="34" r="5" fill={dark} opacity="0.7" />
      <circle cx="31" cy="39" r="3.5" fill={light} opacity="0.85" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Team message — researcher-authored template, never AI-generated     */
/* ------------------------------------------------------------------ */
export function TeamMessage({ message }) {
  if (!message) return null;
  return (
    <div className="team-message">
      <div className="team-message-kicker">From your study team</div>
      <p>{message}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Meal card — one logged meal, photo as a labeled specimen            */
/* ------------------------------------------------------------------ */
export function MealCard({ meal, code, teamMessage }) {
  const t = new Date(meal.timestamp);
  const when = t.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) +
    " · " + t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const items = meal.result.identified_items || [];
  const pending = mealIsPending(meal);
  const corrected = meal.review?.state === "corrected";
  const confirmed = meal.review?.state === "confirmed";
  return (
    <div className={`meal-card${pending ? " meal-card--pending" : ""}`}>
      <SpecimenPhoto src={meal.photo} caption={code || null}>
        {!meal.photo ? <PlatePlaceholder seed={meal.timestamp} /> : null}
      </SpecimenPhoto>
      <div className="meal-body">
        <div className="meal-head">
          {pending ? (
            <StatusPill level="pending" label="Awaiting review" />
          ) : (
            <MatchPill status={meal.result.match_status} />
          )}
          {pending ? (
            <span className="meal-score meal-score--proposed" title="Proposed score — not counted until reviewed">
              {meal.result.score}?
            </span>
          ) : (
            <span className="meal-score">{meal.result.score}</span>
          )}
          {meal.result.confidence ? <ConfidencePill level={meal.result.confidence} /> : null}
          <span className="meal-time">{when}</span>
          {corrected ? (
            <span className="pill pill--neutral" title={`AI proposed "${STATUS_META[meal.review.original?.status]?.label || meal.review.original?.status}"; a researcher corrected it.`}>
              {PILL_ICONS.good} Reviewer-corrected
            </span>
          ) : null}
          {confirmed ? (
            <span className="pill pill--neutral" title="A researcher confirmed this AI match.">
              {PILL_ICONS.good} Reviewer-confirmed
            </span>
          ) : null}
          {meal.engine && meal.engine !== "claude" ? (
            <span className="pill pill--neutral" title="Generated by the demo's simulated analyzer, not a live AI call.">
              {PILL_ICONS.nodata} Simulated
            </span>
          ) : null}
        </div>
        <div className="meal-items">
          {items.map((it) => `${it.name} (${it.estimated_portion})`).join(" · ") || "No items identified"}
        </div>
        <div className="meal-reason">{meal.result.reason}</div>
        {meal.note ? <div className="meal-note">Participant note: “{meal.note}”</div> : null}
        {teamMessage ? <TeamMessage message={teamMessage} /> : null}
      </div>
    </div>
  );
}

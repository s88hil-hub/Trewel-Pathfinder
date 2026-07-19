import { Link, useNavigate, useLocation } from "react-router-dom";
import { STATUS_META, CONFIDENCE_META, mealIsPending } from "../lib/adherence.js";
import { SpecimenPhoto } from "./verification.jsx";
import { useWorkspace } from "../lib/store.jsx";
import { useAuth } from "../lib/auth.jsx";
import { lingoFor } from "../lib/lingo.js";
import trewelLogo from "../assets/trewel-logo.png";
import trewelMark from "../assets/trewel-mark.png";

/* ------------------------------------------------------------------ */
/* Tab icons — used by the mobile bottom bar                           */
/* ------------------------------------------------------------------ */
const TAB_ICONS = {
  plans: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 14l3-3.5 2.5 2L17 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 20.5h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  review: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M11 8v3.2l2 1.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  home: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 11l8-6.5 8 6.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9.5h12V10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  camera: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.5" y="6.5" width="19" height="13.5" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 6.5l1.6-2.8h4.8L16 6.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="13.3" r="3.6" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  ),
};

/* ------------------------------------------------------------------ */
/* Reticle glyph — the verification mark, used standalone (e.g. as a   */
/* loading/empty-state accent) separately from the header wordmark     */
/* ------------------------------------------------------------------ */
export function Reticle({ size = 22 }) {
  return <img src={trewelMark} alt="" width={size} height={size} aria-hidden="true" style={{ display: "block" }} />;
}

/* ------------------------------------------------------------------ */
/* Wordmark                                                            */
/* ------------------------------------------------------------------ */
export function Wordmark({ sub }) {
  return (
    <Link to="/" className="wordmark" aria-label="Trewel home">
      <img src={trewelLogo} alt="Trewel" className="wordmark-logo" />
      {sub ? <span className="wordmark-sub">{sub}</span> : null}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Researcher navigation — consistent across the console               */
/* ------------------------------------------------------------------ */
// Primary practitioner nav — trimmed to three essentials. Privacy & compliance
// now lives inside Settings (linked from there), so the top bar stays focused.
export function usePendingCount() {
  const { data } = useWorkspace();
  return Object.values(data.participants).reduce(
    (n, p) => n + p.meals.filter(mealIsPending).length, 0
  );
}

export function ResearcherNav({ active }) {
  const { data } = useWorkspace();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const lingo = lingoFor(data.settings.researchMode);
  const pending = usePendingCount();
  const cls = (k) => `header-link${active === k ? " header-link--active" : ""}`;
  function signOut() {
    logout();
    navigate("/");
  }
  return (
    <nav className="header-nav" aria-label={lingo.console}>
      <Link className={cls("studies")} to="/researcher/dashboard">{lingo.plans}</Link>
      <Link className={cls("review")} to="/researcher/review">
        Review{pending > 0 ? <span className="nav-badge">{pending}</span> : null}
      </Link>
      <Link className={cls("settings")} to="/researcher/settings">Settings</Link>
      <button className="btn btn--ghost" style={{ fontSize: 13.5 }} onClick={signOut}>Sign out</button>
    </nav>
  );
}

// Practitioner-facing lingo helper for pages.
export function useLingo() {
  const { data } = useWorkspace();
  return lingoFor(data.settings.researchMode);
}

/* ------------------------------------------------------------------ */
/* Bottom tab bar — mobile only (CSS-hidden on desktop). Thumb-reachable, */
/* persistent, safe-area aware. Tabs are passed per surface.             */
/* ------------------------------------------------------------------ */
export function BottomTabs({ tabs }) {
  const location = useLocation();
  if (!tabs?.length) return null;
  return (
    <nav className="bottom-tabs" aria-label="Primary">
      {tabs.map((t) => {
        const active = t.match ? t.match(location.pathname) : location.pathname === t.to;
        return (
          <Link key={t.to} to={t.to}
            className={`bottom-tab${active ? " bottom-tab--active" : ""}${t.warm ? " bottom-tab--warm" : ""}`}
            aria-current={active ? "page" : undefined}>
            {TAB_ICONS[t.icon]}
            <span>{t.label}</span>
            {t.badge > 0 ? <span className="tab-badge">{t.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

// Tab set builders.
export function practitionerTabs(lingo, pending) {
  return [
    { to: "/researcher/dashboard", label: lingo.plans, icon: "plans", match: (p) => p.startsWith("/researcher/dashboard") || p.startsWith("/researcher/studies") },
    { to: "/researcher/review", label: "Review", icon: "review", badge: pending, match: (p) => p.startsWith("/researcher/review") },
    { to: "/researcher/settings", label: "Settings", icon: "settings", match: (p) => p.startsWith("/researcher/settings") || p.startsWith("/researcher/data-handling") },
  ];
}
export function clientTabs(code) {
  return [
    { to: `/participant/${code}`, label: "My plan", icon: "home", match: (p) => p === `/participant/${code}` },
    { to: `/participant/${code}/log`, label: "Log a meal", icon: "camera", warm: true, match: (p) => p.endsWith("/log") },
  ];
}

/* ------------------------------------------------------------------ */
/* Page chrome                                                         */
/* ------------------------------------------------------------------ */
export function Layout({ context, headerRight, narrow, tabs, children }) {
  const location = useLocation();
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
      {/* keyed on pathname so each navigation replays the enter transition */}
      <main key={location.pathname} className={`app-main page-enter${narrow ? " app-main--narrow" : ""}`}>
        {children}
      </main>
      <DataHandlingFooter />
      {tabs ? <BottomTabs tabs={tabs} /> : null}
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
          <strong>Privacy.</strong> Trewel is a prototype. All plan and meal data — including photos —
          is stored in a private, server-side database for demonstration and is transmitted only for
          automated meal analysis. Production deployment in a clinic or trial requires the appropriate data agreements (HIPAA
          business-associate or IRB/institutional, depending on setting) covering photo capture, storage,
          and retention. Automated assessments check adherence to a practitioner-defined plan only; they
          are not medical or dietary advice.
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
export function TeamMessage({ message, from = "your dietitian" }) {
  if (!message) return null;
  return (
    <div className="team-message">
      <div className="team-message-kicker">From {from}</div>
      <p>{message}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rule checks — the differentiator made visible: which plan rule was  */
/* checked, and what the verdict was. Never just a nutrient readout.   */
/* ------------------------------------------------------------------ */
export function RuleChecks({ checks }) {
  if (!checks?.length) return null;
  const mark = { pass: "✓", fail: "✗", unclear: "?" };
  return (
    <div className="rule-checks">
      {checks.map((c, i) => (
        <span key={i} className={`rule-chip rule-chip--${c.result}`}>
          <span aria-hidden="true">{mark[c.result] || "?"}</span> {c.rule}: {c.detail}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Meal card — one logged meal, photo as a labeled specimen            */
/* ------------------------------------------------------------------ */
export function MealCard({ meal, code, teamMessage, teamFrom = "your dietitian" }) {
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
          {meal.engine === "simulated" || meal.engine === "seeded" ? (
            <span className="pill pill--neutral" title="Generated by the demo's simulated analyzer, not a live AI call.">
              {PILL_ICONS.nodata} Simulated
            </span>
          ) : null}
        </div>
        <div className="meal-items">
          {items.map((it) => `${it.name} (${it.estimated_portion})`).join(" · ") || "No items identified"}
        </div>
        <RuleChecks checks={meal.result.rule_checks} />
        <div className="meal-reason">{meal.result.reason}</div>
        {meal.note ? <div className="meal-note">Note: “{meal.note}”</div> : null}
        {teamMessage ? <TeamMessage message={teamMessage} from={teamFrom} /> : null}
      </div>
    </div>
  );
}

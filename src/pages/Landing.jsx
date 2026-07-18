import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Wordmark, PlatePlaceholder, DataHandlingFooter } from "../components/ui.jsx";
import { SpecimenPhoto, ScoreDial, VerdictStamp } from "../components/verification.jsx";
import { joinWaitlist, getWaitlistCount } from "../lib/api.js";

// ---------------------------------------------------------------------------
// Public waitlist landing — the first thing a stranger sees. Fully separate
// from the authenticated app: no login, no account, no store access. A single
// dominant email capture, backed by persistent server-side storage.
// ---------------------------------------------------------------------------

function WaitlistForm({ id, dark = false, count }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | busy | done | error
  const [message, setMessage] = useState(null);
  const [duplicate, setDuplicate] = useState(false);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  async function submit(e) {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setState("error");
      setMessage("That doesn't look like a valid email — mind checking it?");
      return;
    }
    setState("busy");
    setMessage(null);
    try {
      const res = await joinWaitlist(value);
      setDuplicate(Boolean(res.duplicate));
      setState("done");
    } catch (err) {
      setState("error");
      setMessage(err.message);
    }
  }

  if (state === "done") {
    return (
      <div className="waitlist-done">
        <div className="waitlist-check" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <path d="M5 12.5l4.2 4.2L19 7" stroke="var(--accent)" strokeWidth="2.4"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 style={dark ? { color: "var(--paper)" } : undefined}>
          {duplicate ? "You're already on the list" : "You're on the list"}
        </h2>
        <p style={{ margin: "8px 0 0", color: dark ? "rgba(243,242,234,0.72)" : "var(--ink-2)" }}>
          {duplicate
            ? "We already have this email saved — we'll be in touch as spots open up."
            : "Thanks for signing up. We'll email you the moment early access opens."}
        </p>
      </div>
    );
  }

  return (
    <form className="waitlist-form" onSubmit={submit} noValidate>
      <label htmlFor={id} className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
        Email address
      </label>
      <input
        id={id}
        className="input"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@practice.com"
        value={email}
        onChange={(e) => { setEmail(e.target.value); if (state === "error") { setState("idle"); setMessage(null); } }}
        aria-invalid={state === "error"}
        required
      />
      <button className={`btn ${dark ? "btn--warm" : "btn--accent"}`} type="submit" disabled={state === "busy"}>
        {state === "busy" ? "Adding you…" : "Join the waitlist"}
      </button>
      {state === "error" ? (
        <div className="waitlist-error" role="alert">{message}</div>
      ) : (
        <div className="waitlist-meta">
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 1.5l5.5 2.2v3.4c0 3.4-2.3 6.1-5.5 7.4C4.8 13.2 2.5 10.5 2.5 7.1V3.7L8 1.5z"
              fill="none" stroke={dark ? "rgba(243,242,234,0.6)" : "var(--ink-muted)"} strokeWidth="1.3" />
          </svg>
          <span style={dark ? { color: "rgba(243,242,234,0.6)" } : undefined}>
            No spam, ever.{count != null ? <> {" · "}<span className="waitlist-count" style={dark ? { color: "rgba(243,242,234,0.85)" } : undefined}>{count}</span> already waiting.</> : null}
          </span>
        </div>
      )}
    </form>
  );
}

export default function Landing() {
  const [count, setCount] = useState(null);
  useEffect(() => { getWaitlistCount().then(setCount); }, []);

  return (
    <>
      <div className="mkt">
        <nav className="mkt-nav">
          <Wordmark />
          <span className="header-spacer" />
          <Link to="/participant">Have a client code?</Link>
          <Link to="/researcher" className="btn btn--secondary btn--small">Sign in</Link>
        </nav>

        {/* HERO */}
        <header className="mkt-hero">
          <div>
            <span className="mkt-eyebrow"><span className="dot" aria-hidden="true" /> Now onboarding dietitians</span>
            <h1>Know your clients <em>followed the plan</em> — not just what they ate.</h1>
            <p className="mkt-lede">
              Trewel turns each meal photo into a verified adherence check against the plan you wrote —
              rule by rule. No more guessing from a food diary, no more hours of unpaid log review.
            </p>
          </div>

          <div className="waitlist-card">
            <div className="card-kicker">Early access</div>
            <h2>Join the waitlist</h2>
            <p className="muted small" style={{ margin: "0 0 2px" }}>
              Be first to try Trewel with your own clients. We're onboarding practices in small batches.
            </p>
            <WaitlistForm id="wl-hero" count={count} />
          </div>
        </header>

        {/* THE PROBLEM → SOLUTION, in three plain claims */}
        <section className="mkt-props">
          <div className="mkt-prop">
            <svg className="mkt-prop-glyph" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
              <path d="M4 22V4M4 22h18" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M8 17l4-5 3 3 4-7" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h3>Adherence, not just a food log</h3>
            <p>
              Every photo is checked against your plan's actual rules — excluded foods, sodium limits,
              portions — and returns a clear on-track / needs-a-look result. You see which rule was checked.
            </p>
          </div>
          <div className="mkt-prop">
            <svg className="mkt-prop-glyph" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
              <circle cx="13" cy="13" r="9.5" fill="none" stroke="var(--warm)" strokeWidth="1.8" />
              <path d="M13 8v5.2l3.4 2" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h3>Hours of review back in your week</h3>
            <p>
              Confident matches are scored automatically. Only the genuinely ambiguous ones reach your
              review queue — so you spend minutes confirming, not hours reading diaries.
            </p>
          </div>
          <div className="mkt-prop">
            <svg className="mkt-prop-glyph" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
              <path d="M13 2.5l8.5 3.4v5.2c0 5.2-3.6 9.4-8.5 11.4C8.1 20.5 4.5 16.3 4.5 11.1V5.9L13 2.5z"
                fill="none" stroke="var(--ink)" strokeWidth="1.6" />
              <path d="M9.2 12.5l2.6 2.6L17 9.5" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h3>Built for trust</h3>
            <p>
              The AI never invents dietary advice — it reports rule-by-rule facts, and every client message
              is one you pre-wrote. Clients log with a code: no account, no personal data collected.
            </p>
          </div>
        </section>

        {/* THE SIGNATURE MOMENT — a real verified record */}
        <div className="mkt-section-head">
          <div className="card-kicker" style={{ justifyContent: "center", textAlign: "center" }}>The verification record</div>
          <h2>One photo becomes a verified result</h2>
          <p>Your client photographs the plate. Trewel identifies it, checks it against your plan, and scores it — with anything uncertain routed to you.</p>
        </div>
        <div className="mkt-showcase" aria-label="Example: a meal photo becomes a verified adherence record">
          <SpecimenPhoto caption="HTN-4F7K · 12:41" style={{ width: 150 }}>
            <PlatePlaceholder seed={1} />
          </SpecimenPhoto>
          <span className="mkt-showcase-arrow" aria-hidden="true">→</span>
          <ScoreDial score={92} status="on_protocol" size={158} animate={false} />
          <VerdictStamp status="on_protocol" />
        </div>

        {/* HOW IT WORKS */}
        <div className="mkt-section-head">
          <h2>Up and running in minutes</h2>
          <p>No integration, no training data, no setup call. Start with a condition template and invite your first client the same afternoon.</p>
        </div>
        <section className="mkt-steps">
          <div className="mkt-step">
            <span className="mkt-step-num">STEP 01</span>
            <h3>Build a plan</h3>
            <p>Start from a condition template — Type 2 diabetes, PCOS, hypertension, low-FODMAP and more — or write your own rules. Edit anything.</p>
          </div>
          <div className="mkt-step">
            <span className="mkt-step-num">STEP 02</span>
            <h3>Invite your client</h3>
            <p>Trewel generates a code. That's their whole login — no app store account, no name or email stored on our side.</p>
          </div>
          <div className="mkt-step">
            <span className="mkt-step-num">STEP 03</span>
            <h3>See who's on track</h3>
            <p>Meals get checked as they're logged. Your dashboard leads with exactly who needs attention this week.</p>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="mkt-cta-final">
          <h2>Verify adherence. Reclaim your week.</h2>
          <p>
            Join the dietitians and nutritionists using Trewel to turn meal photos into verified,
            reviewable adherence — instead of taking food diaries on faith.
          </p>
          <WaitlistForm id="wl-final" dark count={count} />
        </section>

        <footer className="mkt-footer">
          <Wordmark />
          <span className="header-spacer" />
          <span>Also for researchers · <Link to="/researcher">Practitioner sign-in</Link> · <Link to="/participant">Client code</Link></span>
        </footer>
      </div>

      <DataHandlingFooter />
    </>
  );
}

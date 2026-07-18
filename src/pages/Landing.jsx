import { Link } from "react-router-dom";
import { Layout, PlatePlaceholder } from "../components/ui.jsx";
import { SpecimenPhoto, ScoreDial, VerdictStamp } from "../components/verification.jsx";

export default function Landing() {
  return (
    <Layout>
      <div className="landing-hero">
        <div className="landing-kicker">Plan adherence · Verified</div>
        <h1>
          Know your clients followed the plan —
          <br />
          not just <em>what they ate</em>.
        </h1>
        <p>
          Your client photographs each meal. Trewel checks the photo against the plan you wrote —
          rule by rule: sodium limits, excluded foods, portions — and returns a verified adherence
          score. Anything the AI isn't sure about goes to you, not into the data.
        </p>
      </div>

      {/* the product in one line: photo → verified record */}
      <div className="record-sample" aria-label="Example: a meal photo becomes a verified adherence record">
        <SpecimenPhoto caption="MED24-4F7K · 12:41" style={{ width: 138 }}>
          <PlatePlaceholder seed={1} />
        </SpecimenPhoto>
        <span className="record-sample-arrow" aria-hidden="true">→</span>
        <ScoreDial score={92} status="on_protocol" size={150} animate={false} />
        <VerdictStamp status="on_protocol" />
      </div>

      <div className="role-cards">
        <Link to="/researcher" className="role-card">
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
            <rect x="3" y="4" width="22" height="17" rx="1.5" fill="none" stroke="var(--ink)" strokeWidth="1.8" />
            <path d="M7.5 16.5l4-4.5 3.5 3 5-6" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 24.5h8" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <h2>Practitioner console</h2>
          <p>
            For dietitians and nutritionists: build a care plan from condition templates (diabetes,
            hypertension, low-FODMAP…) or your own rules, invite clients with a code, and see who's
            on track at a glance. Running a formal trial? Research mode is one toggle away.
          </p>
          <span className="go">Sign in or create an account →</span>
        </Link>

        <Link to="/participant" className="role-card">
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
            <rect x="6" y="2.5" width="16" height="23" rx="2" fill="none" stroke="var(--ink)" strokeWidth="1.8" />
            <circle cx="14" cy="13" r="4.5" fill="none" stroke="var(--accent)" strokeWidth="1.8" />
            <circle cx="14" cy="13" r="1.5" fill="var(--accent)" />
          </svg>
          <h2>Client logging</h2>
          <p>
            Got a code from your dietitian or study coordinator? Read your plan in plain language and
            log each meal with one photo. You see the check the moment it lands — no account, no forms.
          </p>
          <span className="go">Enter your code →</span>
        </Link>
      </div>

      <p className="muted small" style={{ textAlign: "center", marginTop: 40 }}>
        Trewel is a plan-adherence verification tool for nutrition professionals and researchers. It
        does not diagnose, treat, or give dietary advice — it logs meals and checks them against a
        plan its practitioner defined.
      </p>
    </Layout>
  );
}

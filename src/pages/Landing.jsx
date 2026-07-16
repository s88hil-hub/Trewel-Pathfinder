import { Link } from "react-router-dom";
import { Layout, PlatePlaceholder } from "../components/ui.jsx";
import { SpecimenPhoto, ScoreDial, VerdictStamp } from "../components/verification.jsx";

export default function Landing() {
  return (
    <Layout>
      <div className="landing-hero">
        <div className="landing-kicker">Dietary adherence · Verified</div>
        <h1>
          Nutrition trials run on self-report.
          <br />
          Trewel runs on <em>evidence</em>.
        </h1>
        <p>
          Participants photograph each meal. Trewel's AI matcher checks the photo against the diet
          protocol you defined and returns an objective adherence score — meal by meal, day by day,
          for the length of your study.
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
          <h2>Researcher console</h2>
          <p>
            Define diet protocols as structured, exportable rules. Enroll participants under anonymous
            codes. Read adherence at a glance — daily and weekly rollups, with flags on anyone
            trending off-protocol.
          </p>
          <span className="go">Open the console →</span>
        </Link>

        <Link to="/participant" className="role-card">
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
            <rect x="6" y="2.5" width="16" height="23" rx="2" fill="none" stroke="var(--ink)" strokeWidth="1.8" />
            <circle cx="14" cy="13" r="4.5" fill="none" stroke="var(--accent)" strokeWidth="1.8" />
            <circle cx="14" cy="13" r="1.5" fill="var(--accent)" />
          </svg>
          <h2>Participant logging</h2>
          <p>
            Enter your study code, read your protocol in plain language, and log each meal with one
            photo. You see the match result the moment it's checked.
          </p>
          <span className="go">Enter your code →</span>
        </Link>
      </div>

      <p className="muted small" style={{ textAlign: "center", marginTop: 40 }}>
        Trewel is a research support and data-collection tool. It does not diagnose, treat, or give
        dietary advice — it logs meals and scores adherence against a researcher-defined protocol.
      </p>
    </Layout>
  );
}

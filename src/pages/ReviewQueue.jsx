import { Link } from "react-router-dom";
import { Layout, ResearcherNav, MatchPill, ConfidencePill, PlatePlaceholder, RuleChecks, useLingo } from "../components/ui.jsx";
import { SpecimenPhoto } from "../components/verification.jsx";
import { useWorkspace } from "../lib/store.jsx";
import { mealIsPending, STATUS_META, reviewStats } from "../lib/adherence.js";

const ALL_STATUSES = ["on_protocol", "partial_deviation", "off_protocol"];

// The review queue: every low-confidence AI match, waiting for a human
// decision. Confirming or correcting immediately updates the participant's
// real adherence score and clears the item.
export default function ReviewQueue() {
  const { data, reviewMeal } = useWorkspace();
  const lingo = useLingo();

  const items = [];
  for (const p of Object.values(data.participants)) {
    const study = data.studies[p.studyId];
    for (const meal of p.meals) {
      if (mealIsPending(meal)) items.push({ participant: p, study, meal });
    }
  }
  items.sort((a, b) => b.meal.timestamp - a.meal.timestamp);

  const allMeals = Object.values(data.participants).flatMap((p) => p.meals);
  const stats = reviewStats(allMeals);

  return (
    <Layout context={lingo.console} headerRight={<ResearcherNav active="review" />}>
      <div className="section-head">
        <div>
          <h1>Review queue</h1>
          <p className="muted small" style={{ margin: "4px 0 0", maxWidth: 640 }}>
            Matches the AI wasn't sure about. They don't count toward any adherence score until you
            confirm or correct them — your decision applies immediately.
          </p>
        </div>
        <span className="kicker">{items.length} awaiting review</span>
      </div>

      {!items.length ? (
        <div className="empty">
          Queue clear — every recent meal was matched confidently.
          {" "}<Link to="/researcher/dashboard">Back to {lingo.plansLower}</Link>
        </div>
      ) : (
        <div className="meal-list">
          {items.map(({ participant, study, meal }) => (
            <QueueCard key={meal.id}
              participant={participant} study={study} meal={meal}
              onDecide={(decision) => reviewMeal(participant.code, meal.id, decision)} />
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-kicker">Why this queue exists</div>
        <p className="small" style={{ margin: 0 }}>
          Trewel scores a meal automatically only when the AI reports high or medium confidence —
          across this workspace that's {stats.autoPct}% of {stats.total} analyzed meals. The rest land
          here for a human decision instead of being guessed. Reviewed decisions are recorded in the{" "}
          <Link to="/researcher/data-handling">audit log</Link>.
        </p>
      </div>
    </Layout>
  );
}

function QueueCard({ participant, study, meal, onDecide }) {
  const t = new Date(meal.timestamp);
  const when = t.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) +
    " · " + t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const items = meal.result.identified_items || [];
  const proposed = meal.result.match_status;
  const alternatives = ALL_STATUSES.filter((s) => s !== proposed);

  return (
    <div className="queue-card">
      <SpecimenPhoto src={meal.photo} caption={participant.code}>
        {!meal.photo ? <PlatePlaceholder seed={meal.timestamp} /> : null}
      </SpecimenPhoto>
      <div className="queue-body">
        <div className="card-kicker">{study?.name || "Study"}</div>
        <div className="meal-head" style={{ marginTop: 2 }}>
          <span className="muted small mono">AI proposes</span>
          <MatchPill status={proposed} />
          <span className="meal-score meal-score--proposed">{meal.result.score}?</span>
          <ConfidencePill level={meal.result.confidence} />
          <span className="meal-time">{when}</span>
        </div>
        <div className="meal-items">
          {items.map((it) => `${it.name} (${it.estimated_portion})`).join(" · ") || "No items identified"}
        </div>
        <RuleChecks checks={meal.result.rule_checks} />
        <div className="meal-reason">{meal.result.reason}</div>
        {meal.note ? <div className="meal-note">Participant note: “{meal.note}”</div> : null}
        <div className="queue-actions">
          <button className="btn btn--small" onClick={() => onDecide({ action: "confirm" })}>
            Confirm “{STATUS_META[proposed].label}”
          </button>
          <span className="correct-label">or correct to</span>
          {alternatives.map((s) => (
            <button key={s} className="btn btn--secondary btn--small"
              onClick={() => onDecide({ action: "correct", newStatus: s })}>
              {STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

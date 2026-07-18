import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Layout, ConfidencePill, TeamMessage, RuleChecks, clientTabs } from "../components/ui.jsx";
import { SpecimenPhoto, ScoreDial, VerdictStamp } from "../components/verification.jsx";
import { useParticipantLookup } from "../lib/store.jsx";
import { teamLabelForStudy } from "../lib/lingo.js";
import { preparePhoto, requestMealAnalysis } from "../lib/api.js";
import { findResponseTemplate } from "../lib/protocolTemplates.js";

export default function LogMeal() {
  const { code } = useParams();
  const lookup = useParticipantLookup(code);
  const participant = lookup?.participant;
  const study = lookup?.study;

  const fileRef = useRef(null);
  const [photo, setPhoto] = useState(null); // { dataUrl, base64, mediaType }
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [phase, setPhase] = useState("compose"); // compose | analyzing | done
  const [outcome, setOutcome] = useState(null); // { engine, result }
  const [savedMeal, setSavedMeal] = useState(null);
  const [error, setError] = useState(null);

  if (!participant || !study) {
    return (
      <Layout narrow context="Client">
        <div className="empty" style={{ marginTop: 48 }}>
          That code didn't match an active plan. <Link to="/participant">Enter your code</Link>
        </div>
      </Layout>
    );
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      setPhoto(await preparePhoto(file));
    } catch (err) {
      setError(err.message);
    }
  }

  async function submit() {
    if (!photo) return;
    setPhase("analyzing");
    setError(null);
    try {
      const res = await requestMealAnalysis({
        base64: photo.base64,
        mediaType: photo.mediaType,
        note: note.trim(),
        protocol: study.protocol,
      });
      const meal = {
        id: `meal_${Date.now()}`,
        timestamp: Date.now(),
        photo: photo.dataUrl,
        note: note.trim(),
        engine: res.engine,
        result: res.result,
      };
      const saved = lookup.addMeal(meal); // store decides pending vs auto-verified
      setSavedMeal(saved);
      setOutcome(res);
      setPhase("done");
    } catch (err) {
      setError(`The check didn't complete (${err.message || "connection problem"}). Your photo is still here — try again.`);
      setPhase("compose");
    }
  }

  function reset() {
    setPhoto(null);
    setNote("");
    setShowNote(false);
    setOutcome(null);
    setSavedMeal(null);
    setError(null);
    setPhase("compose");
    if (fileRef.current) fileRef.current.value = "";
  }

  const analyzing = phase === "analyzing";

  return (
    <Layout narrow context={<>Client · <span className="code-chip">{code}</span></>}
      headerRight={<Link className="header-link" to={`/participant/${code}`}>← My log</Link>}
      tabs={clientTabs(code)}>

      {phase !== "done" ? (
        <>
          <h1>Log this meal</h1>

          {/* PHOTO FIRST — the whole task is one photo */}
          {!photo ? (
            <div className="capture-zone" onClick={() => fileRef.current?.click()} role="button" tabIndex={0}
              aria-label="Take or choose a photo of your plate"
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }}
              style={{ marginTop: 16 }}>
              <div className="cz-ring" aria-hidden="true">
                <svg width="34" height="34" viewBox="0 0 40 40">
                  <rect x="4" y="10" width="32" height="24" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="M14 10l2.5-4h7l2.5 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <circle cx="20" cy="22" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>
              <div className="cz-title">Photograph your plate</div>
              <div className="cz-hint">Tap to open your camera — just the food in frame</div>
            </div>
          ) : (
            <div style={{ marginTop: 16 }}>
              <SpecimenPhoto src={photo.dataUrl} alt="Your meal photo, ready to check"
                caption={`${code} · ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}
                style={{ width: "100%" }} />
              {!analyzing ? (
                <div style={{ marginTop: 8 }}>
                  <button className="btn btn--ghost" onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = ""; }}>
                    Retake photo
                  </button>
                </div>
              ) : null}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={onFile} />

          {/* Optional note — hidden until asked for, so it never adds friction */}
          {photo && !analyzing ? (
            <div className="note-disclosure">
              {!showNote ? (
                <button className="note-toggle" aria-expanded="false" onClick={() => setShowNote(true)}>
                  <span className="chev" aria-hidden="true">›</span> Add a note (optional)
                </button>
              ) : (
                <div className="field" style={{ marginTop: 4 }}>
                  <label htmlFor="note">Anything the photo doesn't show?</label>
                  <textarea id="note" className="textarea" value={note} autoFocus onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. 'dressing on the side', 'shared this portion'." />
                </div>
              )}
            </div>
          ) : null}

          {error ? <div className="banner banner--notice" style={{ marginTop: 16 }}>{error}</div> : null}

          <button className="btn btn--warm btn--lg btn--block" style={{ marginTop: 20 }}
            disabled={!photo || analyzing} onClick={submit}>
            {analyzing ? (<><span className="spinner" /> Checking against your plan…</>) : "Log this meal"}
          </button>
          <p className="muted small" style={{ textAlign: "center", marginTop: 10 }}>
            Photograph the plate only — keep people and surroundings out of frame. It's a check-in, not a
            judgment, and never dietary advice.
          </p>
        </>
      ) : (
        <ResultView outcome={outcome} meal={savedMeal} study={study} code={code} onLogAnother={reset} />
      )}
    </Layout>
  );
}

/* ------------------------------------------------------------------ */
/* The verification record — the match-result moment                   */
/* ------------------------------------------------------------------ */
function ResultView({ outcome, meal, study, code, onLogAnother }) {
  const team = teamLabelForStudy(study);
  const r = outcome.result;
  const pending = meal.review?.state === "pending";
  const onPlan = !pending && r.match_status === "on_protocol";
  const t = new Date(meal.timestamp);
  const caption = `${code} · ${t.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  const recordNo = `TRW-${String(meal.timestamp).slice(-6)}`;
  const teamMessage = !pending ? findResponseTemplate(study.protocol, r)?.message : null;

  // One clear headline state, not a block of text to parse.
  const headline = pending
    ? "Logged — one quick check left"
    : onPlan
      ? "On plan ✓"
      : r.match_status === "partial_deviation"
        ? "Logged — worth a look"
        : "Logged — off plan today";

  return (
    <>
      <h1>{headline}</h1>
      <div className="record record--reveal" style={{ marginTop: 16 }}>
        <div className="record-head">
          <span className="kicker">Verification record</span>
          <span className="kicker mono">{recordNo}</span>
        </div>
        <div className="record-body">
          <div className="record-photo">
            <SpecimenPhoto src={meal.photo} alt="Your logged meal" caption={caption} style={{ width: "100%" }} />
          </div>
          <div className="record-verdict">
            <div className={onPlan ? "verdict-halo" : undefined}>
              <ScoreDial score={r.score} status={r.match_status} pending={pending} />
            </div>
            <VerdictStamp status={r.match_status} pending={pending} />
            <ConfidencePill level={r.confidence} />
          </div>
          <div className="record-findings">
            {pending ? (
              <div className="banner" style={{ marginBottom: 14 }}>
                <span>
                  <strong>{study.surface === "research" ? "Your study team" : "Your dietitian"} will take a
                  quick look.</strong> The matcher wasn't confident enough to score this one
                  automatically, so a person will confirm it. It doesn't count toward your adherence
                  score until then — nothing you need to do.
                </span>
              </div>
            ) : null}
            <div className="card-kicker">Identified in this photo</div>
            <ul>
              {(r.identified_items || []).map((it, i) => (
                <li key={i}>
                  <span>{it.name}</span>
                  <span className="portion">{it.estimated_portion}</span>
                </li>
              ))}
              {!r.identified_items?.length ? <li className="muted">No food items identified</li> : null}
            </ul>
            <div className="card-kicker">Checked against your plan</div>
            <RuleChecks checks={r.rule_checks} />
            <p style={{ margin: "6px 0 0", fontSize: 15 }}>{r.reason}</p>
            {teamMessage ? <TeamMessage message={teamMessage} from={team} /> : null}
            {r.privacy_flag ? (
              <div className="banner banner--notice" style={{ marginTop: 14, marginBottom: 0 }}>
                This photo may include people or surroundings. Next time, frame the plate only.
              </div>
            ) : null}
          </div>
        </div>
        <div className="ai-note" style={{ margin: "0 22px 16px", paddingTop: 12 }}>
          {outcome.engine === "simulated" || outcome.engine === "seeded"
            ? "Demo mode: this record came from Trewel's simulated analyzer (no AI credentials configured). Deviation messages are pre-written by " + team + " — Trewel never generates its own dietary guidance."
            : "Checked by Trewel's AI meal-matcher against your plan, rule by rule. Deviation messages are pre-written by " + team + " — Trewel never generates its own dietary guidance."}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
        <Link to={`/participant/${code}`} className="btn btn--secondary" style={{ flex: 1, minWidth: 180 }}>Back to my log</Link>
        <button className="btn btn--warm" style={{ flex: 1, minWidth: 180 }} onClick={onLogAnother}>Log another meal</button>
      </div>
    </>
  );
}

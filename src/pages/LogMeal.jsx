import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Layout, ConfidencePill, TeamMessage } from "../components/ui.jsx";
import { SpecimenPhoto, ScoreDial, VerdictStamp } from "../components/verification.jsx";
import { useStore } from "../lib/store.jsx";
import { preparePhoto, requestMealAnalysis } from "../lib/api.js";
import { findResponseTemplate } from "../lib/protocolTemplates.js";

export default function LogMeal() {
  const { code } = useParams();
  const { data, addMeal } = useStore();
  const participant = data.participants[code];
  const study = participant ? data.studies[participant.studyId] : null;

  const fileRef = useRef(null);
  const [photo, setPhoto] = useState(null); // { dataUrl, base64, mediaType }
  const [note, setNote] = useState("");
  const [phase, setPhase] = useState("compose"); // compose | analyzing | done
  const [outcome, setOutcome] = useState(null); // { engine, result }
  const [savedMeal, setSavedMeal] = useState(null);
  const [error, setError] = useState(null);

  if (!participant || !study) {
    return (
      <Layout narrow context="Participant">
        <div className="empty" style={{ marginTop: 48 }}>
          That participant code didn't match an active study. <Link to="/participant">Enter your code</Link>
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
      const saved = addMeal(code, meal); // addMeal decides pending vs auto-verified
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
    setOutcome(null);
    setSavedMeal(null);
    setError(null);
    setPhase("compose");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <Layout narrow context={<>Participant · <span className="code-chip">{code}</span></>}
      headerRight={<Link className="header-link" to={`/participant/${code}`}>← My log</Link>}>

      {phase !== "done" ? (
        <>
          <h1>Log this meal</h1>
          <div className="banner banner--notice" style={{ marginTop: 14 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
              <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 4.6v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              <circle cx="8" cy="11.2" r="0.9" fill="currentColor" />
            </svg>
            <span>
              <strong>Photograph the plate only.</strong> Fill the frame with the food. Keep people,
              faces, screens, and the room out of the shot — the study needs the meal, nothing else.
            </span>
          </div>

          {!photo ? (
            <div className="photo-drop" onClick={() => fileRef.current?.click()} role="button" tabIndex={0}
              aria-label="Take or choose a photo of your plate"
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }}>
              <svg width="42" height="42" viewBox="0 0 40 40" aria-hidden="true" style={{ marginBottom: 10 }}>
                <rect x="4" y="10" width="32" height="24" rx="2" fill="none" stroke="var(--ink)" strokeWidth="2" />
                <path d="M14 10l2.5-4h7l2.5 4" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
                <circle cx="20" cy="22" r="6" fill="none" stroke="var(--accent)" strokeWidth="2" />
                <circle cx="20" cy="22" r="1.8" fill="var(--accent)" />
              </svg>
              <div style={{ fontWeight: 600, fontSize: 16 }}>Photograph your plate</div>
              <div className="muted small" style={{ marginTop: 4 }}>Tap here — on a phone this opens your camera</div>
            </div>
          ) : (
            <div>
              <SpecimenPhoto src={photo.dataUrl} alt="Your meal photo, ready to check"
                caption={`${code} · ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}
                style={{ width: "100%" }} />
              <div style={{ marginTop: 8 }}>
                <button className="btn btn--ghost" onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = ""; }}>
                  Retake photo
                </button>
              </div>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={onFile} />

          <div className="field" style={{ marginTop: 20 }}>
            <label htmlFor="note">Add a note (optional)</label>
            <textarea id="note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Anything the photo doesn't show — 'dressing on the side', 'shared portion'." />
          </div>

          {error ? <div className="banner banner--notice">{error}</div> : null}

          <button className="btn btn--lg" style={{ width: "100%" }} disabled={!photo || phase === "analyzing"} onClick={submit}>
            {phase === "analyzing" ? (<><span className="spinner" /> Checking against your protocol…</>) : "Log this meal"}
          </button>
          <p className="muted small" style={{ textAlign: "center" }}>
            Your photo is checked against your study's protocol — nothing else. Research logging, not
            dietary advice.
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
  const r = outcome.result;
  const pending = meal.review?.state === "pending";
  const t = new Date(meal.timestamp);
  const caption = `${code} · ${t.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  const recordNo = `TRW-${String(meal.timestamp).slice(-6)}`;
  const teamMessage = !pending ? findResponseTemplate(study.protocol, r)?.message : null;

  return (
    <>
      <h1>{pending ? "Meal logged — one extra step" : "Meal logged"}</h1>
      <div className="record" style={{ marginTop: 16 }}>
        <div className="record-head">
          <span className="kicker">Verification record</span>
          <span className="kicker mono">{recordNo}</span>
        </div>
        <div className="record-body">
          <div className="record-photo">
            <SpecimenPhoto src={meal.photo} alt="Your logged meal" caption={caption} style={{ width: "100%" }} />
          </div>
          <div className="record-verdict">
            <ScoreDial score={r.score} status={r.match_status} pending={pending} />
            <VerdictStamp status={r.match_status} pending={pending} />
            <ConfidencePill level={r.confidence} />
          </div>
          <div className="record-findings">
            {pending ? (
              <div className="banner" style={{ marginBottom: 14 }}>
                <span>
                  <strong>Your study team will take a quick look.</strong> The matcher wasn't confident
                  enough to score this one automatically, so a researcher will confirm it. It doesn't
                  count toward your adherence score until then — nothing you need to do.
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
            <div className="card-kicker">Protocol match</div>
            <p style={{ margin: "6px 0 0", fontSize: 15 }}>{r.reason}</p>
            {teamMessage ? <TeamMessage message={teamMessage} /> : null}
            {r.privacy_flag ? (
              <div className="banner banner--notice" style={{ marginTop: 14, marginBottom: 0 }}>
                This photo may include people or surroundings. Next time, frame the plate only.
              </div>
            ) : null}
          </div>
        </div>
        <div className="ai-note" style={{ margin: "0 22px 16px", paddingTop: 12 }}>
          {outcome.engine === "simulated" || outcome.engine === "seeded"
            ? "Demo mode: this record came from Trewel's simulated analyzer (no AI credentials configured). Deviation messages are pre-written by your study team — Trewel never generates its own dietary guidance."
            : "Checked by Trewel's AI meal-matcher against your study's protocol. Deviation messages are pre-written by your study team — Trewel never generates its own dietary guidance."}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
        <Link to={`/participant/${code}`} className="btn" style={{ flex: 1, minWidth: 180 }}>Back to my log</Link>
        <button className="btn btn--secondary" style={{ flex: 1, minWidth: 180 }} onClick={onLogAnother}>Log another meal</button>
      </div>
    </>
  );
}

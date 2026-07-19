import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/ui.jsx";
import { useAllParticipantCodes } from "../lib/store.jsx";

export default function ParticipantJoin() {
  const navigate = useNavigate();
  const allCodes = useAllParticipantCodes();
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);

  // Surface a few seeded codes so the demo is one click away.
  const sampleCodes = allCodes.slice(0, 3);

  async function submit(e) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setChecking(true);
    setError(null);
    try {
      const res = await fetch(`/api/participant/${encodeURIComponent(clean)}`);
      if (res.ok) {
        navigate(`/participant/${clean}`);
      } else {
        setError("That code didn't match an active plan. Double-check it with whoever gave it to you.");
      }
    } catch {
      setError("Couldn't check that code — check your connection and try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <Layout narrow context="Client">
      <div className="card" style={{ maxWidth: 450, margin: "56px auto 0" }}>
        <div className="card-kicker">Join your plan</div>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Enter your code</h1>
        <p className="muted small" style={{ marginTop: 0 }}>
          Your dietitian or study coordinator gave you a code like{" "}
          <span className="code-chip">HTN-4F7K</span>. Trewel knows you by this code only — no name,
          no email, no account to create.
        </p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="code">Your code</label>
            <input id="code" className="input" value={code} autoFocus
              onChange={(e) => { setCode(e.target.value); setError(null); }}
              placeholder="HTN-4F7K"
              style={{ fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.05em" }} />
            {error ? <div className="hint" style={{ color: "var(--off-text)", fontWeight: 500 }}>{error}</div> : null}
          </div>
          <button className="btn" type="submit" disabled={checking} style={{ width: "100%" }}>
            {checking ? "Checking…" : "Open my plan"}
          </button>
        </form>
        <hr className="divider" />
        <p className="muted small" style={{ margin: 0 }}>
          Demo codes:{" "}
          {sampleCodes.map((c, i) => (
            <span key={c}>
              {i > 0 ? " · " : ""}
              <button className="btn btn--ghost" style={{ padding: "1px 6px", fontFamily: "var(--font-mono)", fontSize: 12 }}
                onClick={() => navigate(`/participant/${c}`)}>{c}</button>
            </span>
          ))}
        </p>
      </div>
    </Layout>
  );
}

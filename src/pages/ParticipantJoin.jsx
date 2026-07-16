import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/ui.jsx";
import { useStore } from "../lib/store.jsx";

export default function ParticipantJoin() {
  const navigate = useNavigate();
  const { data } = useStore();
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);

  // Surface a few seeded codes so the demo is one click away.
  const sampleCodes = Object.keys(data.participants).slice(0, 3);

  function submit(e) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (data.participants[clean]) {
      navigate(`/participant/${clean}`);
    } else {
      setError("That code didn't match any active study. Check it with your study coordinator.");
    }
  }

  return (
    <Layout narrow context="Participant">
      <div className="card" style={{ maxWidth: 450, margin: "56px auto 0" }}>
        <div className="card-kicker">Join your study</div>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Enter your participant code</h1>
        <p className="muted small" style={{ marginTop: 0 }}>
          Your study coordinator gave you a code like <span className="code-chip">MED24-4F7K</span>.
          Trewel knows you by this code only — no name, no email, no personal details.
        </p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="code">Participant code</label>
            <input id="code" className="input" value={code} autoFocus
              onChange={(e) => { setCode(e.target.value); setError(null); }}
              placeholder="MED24-4F7K"
              style={{ fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.05em" }} />
            {error ? <div className="hint" style={{ color: "var(--off-text)", fontWeight: 500 }}>{error}</div> : null}
          </div>
          <button className="btn" type="submit" style={{ width: "100%" }}>Open my study</button>
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

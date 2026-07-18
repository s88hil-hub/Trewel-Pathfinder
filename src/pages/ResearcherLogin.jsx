import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Layout } from "../components/ui.jsx";
import { useAuth, DEMO_USER } from "../lib/auth.jsx";
import { useStore } from "../lib/store.jsx";

export default function ResearcherLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, user, ready } = useAuth();
  const { logAudit } = useStore();

  const [mode, setMode] = useState("signin"); // signin | signup
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Already signed in? Straight through.
  useEffect(() => {
    if (ready && user) {
      navigate(location.state?.from || "/researcher/dashboard", { replace: true });
    }
  }, [ready, user, navigate, location.state]);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const record =
        mode === "signup"
          ? await register(name, email, password)
          : await login(email, password);
      logAudit(record.id, mode === "signup" ? "Account created" : "Signed in", "Console access", record.email);
      navigate(location.state?.from || "/researcher/dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setError(null);
  }

  return (
    <Layout narrow context="Practitioner console">
      <div className="card" style={{ maxWidth: 440, margin: "56px auto 0" }}>
        <div className="card-kicker">{mode === "signup" ? "Create your account" : "Practitioner sign-in"}</div>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>
          {mode === "signup" ? "Start verifying adherence" : "Open your workspace"}
        </h1>
        <p className="muted small" style={{ marginTop: 0 }}>
          {mode === "signup"
            ? "Set up a plan and invite your first client in a few minutes. Trewel checks whether your clients followed their plan — not just what they ate."
            : "Your plans, clients, and meal logs are saved to your account."}
        </p>

        <form onSubmit={submit}>
          {mode === "signup" ? (
            <div className="field">
              <label htmlFor="name">Your name</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dana Rivera, RD" autoComplete="name" />
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" required value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }} autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="pw">Password</label>
            <input id="pw" className="input" type="password" required value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              placeholder={mode === "signup" ? "At least 8 characters" : ""}
              autoComplete={mode === "signup" ? "new-password" : "current-password"} />
            {error ? <div className="hint" style={{ color: "var(--off-text)", fontWeight: 500 }}>{error}</div> : null}
          </div>
          <button className="btn" type="submit" disabled={busy} style={{ width: "100%" }}>
            {busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <hr className="divider" />
        <p className="muted small" style={{ margin: 0 }}>
          {mode === "signup" ? (
            <>Already have an account?{" "}
              <button className="btn btn--ghost" style={{ padding: "1px 6px" }} onClick={() => switchMode("signin")}>Sign in</button></>
          ) : (
            <>New to Trewel?{" "}
              <button className="btn btn--ghost" style={{ padding: "1px 6px" }} onClick={() => switchMode("signup")}>Create an account</button>
              <span className="muted"> · Or explore the sample workspace: </span>
              <span className="code-chip">{DEMO_USER.email}</span> / <span className="code-chip">{DEMO_USER.password}</span></>
          )}
        </p>
      </div>
    </Layout>
  );
}

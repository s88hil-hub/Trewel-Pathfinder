import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Layout } from "../components/ui.jsx";
import { useStore } from "../lib/store.jsx";

export default function ResearcherLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logAudit } = useStore();
  const [email, setEmail] = useState("s.chen@university.edu");
  const [password, setPassword] = useState("");

  function submit(e) {
    e.preventDefault();
    sessionStorage.setItem("trewel-researcher", "1");
    sessionStorage.setItem("trewel-researcher-email", email.trim() || "researcher");
    logAudit("Researcher signed in", "Console access", email.trim() || "researcher");
    navigate(location.state?.from || "/researcher/dashboard", { replace: true });
  }

  return (
    <Layout narrow context="Researcher console">
      <div className="card" style={{ maxWidth: 430, margin: "56px auto 0" }}>
        <div className="card-kicker">Researcher sign-in</div>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Open your workspace</h1>
        <p className="muted small" style={{ marginTop: 0 }}>
          Demo build — any password opens the sample workspace.
        </p>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">Institutional email</label>
            <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="pw">Password</label>
            <input id="pw" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Any password works here" />
          </div>
          <button className="btn" type="submit" style={{ width: "100%" }}>Sign in</button>
        </form>
      </div>
    </Layout>
  );
}

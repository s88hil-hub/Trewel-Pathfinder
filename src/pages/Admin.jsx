import { useEffect, useState } from "react";
import { Layout, Wordmark } from "../components/ui.jsx";

// Simple password-protected admin panel: waitlist signups and practitioner
// accounts. Auth is a single shared admin password (ADMIN_PASSWORD env var)
// behind a signed cookie — see server/authServer.mjs. Every admin data
// endpoint independently checks that cookie server-side, so nothing here
// renders without the server actually granting access.
export default function Admin() {
  const [authed, setAuthed] = useState(null); // null = checking, true/false once known
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [waitlist, setWaitlist] = useState(null);
  const [practitioners, setPractitioners] = useState(null);
  const [loadError, setLoadError] = useState(null);

  async function loadData() {
    setLoadError(null);
    try {
      const [wl, pr] = await Promise.all([
        fetch("/api/admin/waitlist", { credentials: "include" }),
        fetch("/api/admin/practitioners", { credentials: "include" }),
      ]);
      if (wl.status === 401 || pr.status === 401) { setAuthed(false); return; }
      const wlBody = await wl.json();
      const prBody = await pr.json();
      setWaitlist(wlBody.signups || []);
      setPractitioners(prBody.practitioners || []);
      setAuthed(true);
    } catch {
      setLoadError("Couldn't load admin data. Try refreshing.");
    }
  }

  useEffect(() => { loadData(); }, []);

  async function submitLogin(e) {
    e.preventDefault();
    setBusy(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Incorrect password.");
      setPassword("");
      await loadData();
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" }).catch(() => {});
    setAuthed(false);
    setWaitlist(null);
    setPractitioners(null);
  }

  if (authed === null) {
    return (
      <Layout narrow context="Admin">
        <p className="muted" style={{ marginTop: 48, textAlign: "center" }}>Loading…</p>
      </Layout>
    );
  }

  if (!authed) {
    return (
      <Layout narrow context="Admin">
        <div className="card" style={{ maxWidth: 400, margin: "56px auto 0" }}>
          <div className="card-kicker">Admin</div>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Sign in</h1>
          <p className="muted small" style={{ marginTop: 0 }}>Waitlist signups and practitioner accounts — internal use only.</p>
          <form onSubmit={submitLogin}>
            <div className="field">
              <label htmlFor="admin-pw">Admin password</label>
              <input id="admin-pw" className="input" type="password" autoFocus required
                value={password} onChange={(e) => { setPassword(e.target.value); setLoginError(null); }} />
              {loginError ? <div className="hint" style={{ color: "var(--off-text)", fontWeight: 500 }}>{loginError}</div> : null}
            </div>
            <button className="btn" type="submit" disabled={busy} style={{ width: "100%" }}>
              {busy ? "Checking…" : "Sign in"}
            </button>
          </form>
        </div>
      </Layout>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <Wordmark sub="Admin" />
          <span className="header-spacer" />
          <button className="btn btn--ghost" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <main className="app-main">
        <h1>Admin</h1>
        {loadError ? <div className="banner banner--notice">{loadError}</div> : null}

        <div className="section-head">
          <h2>Waitlist signups</h2>
          <span className="kicker">{waitlist?.length ?? 0} total</span>
        </div>
        <div className="card" style={{ padding: 8 }}>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Email</th><th>Signed up</th></tr></thead>
              <tbody>
                {(waitlist || []).map((s) => (
                  <tr key={s.email}>
                    <td className="mono">{s.email}</td>
                    <td className="muted mono" style={{ fontSize: 12.5 }}>
                      {new Date(s.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}{" "}
                      {new Date(s.timestamp).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
                {!waitlist?.length ? (
                  <tr><td colSpan={2} className="muted" style={{ textAlign: "center", padding: 20 }}>No signups yet.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="section-head">
          <h2>Practitioner accounts</h2>
          <span className="kicker">{practitioners?.length ?? 0} total</span>
        </div>
        <div className="card" style={{ padding: 8 }}>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Name</th><th>Email</th><th>Signed up</th><th className="num">Plans</th><th className="num">Clients</th></tr></thead>
              <tbody>
                {(practitioners || []).map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className="mono">{p.email}</td>
                    <td className="muted mono" style={{ fontSize: 12.5 }}>
                      {new Date(p.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="num">{p.planCount}</td>
                    <td className="num">{p.clientCount}</td>
                  </tr>
                ))}
                {!practitioners?.length ? (
                  <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: 20 }}>No accounts yet.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

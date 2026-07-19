import { createContext, useContext, useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Practitioner authentication — real server-side accounts.
//
// Accounts, password hashes, and sessions now live in Postgres (see
// server/db.mjs, server/authServer.mjs, server/appRouter.mjs), not in the
// browser. A session is an HttpOnly cookie the server sets on register/
// login and reads on every request, so signing in on one device is
// recognized by any other device the moment they load the app — the whole
// point of moving off localStorage.
// ---------------------------------------------------------------------------

export const DEMO_USER = {
  email: "s.chen@university.edu",
  name: "Dr. Sam Chen",
  password: "trewel-demo", // published demo credentials — sample workspace only
};

async function api(path, body) {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setUser(data.user || null))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  const value = useMemo(
    () => ({
      ready,
      user,
      async register(name, email, password) {
        const data = await api("/auth/register", { name, email, password });
        setUser(data.user);
        return data.user;
      },
      async login(email, password) {
        const data = await api("/auth/login", { email, password });
        setUser(data.user);
        return data.user;
      },
      async logout() {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
        setUser(null);
      },
    }),
    [ready, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

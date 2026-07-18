import { createContext, useContext, useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Practitioner authentication — real email/password accounts.
//
// Passwords are never stored: they are hashed with PBKDF2 (WebCrypto,
// 150k iterations, per-user random salt) and only the derived hash is kept.
// Sessions are 30-day tokens. Each account owns an isolated workspace
// (see store.jsx), so a practitioner's plans, clients, and meal logs
// persist across refreshes and sessions.
//
// Storage backing is the browser (localStorage) — deliberately provider-free
// so the app runs identically on localhost and static hosting. The auth and
// storage layers are isolated here so a hosted database can replace them
// without touching the UI.
// ---------------------------------------------------------------------------

const USERS_KEY = "trewel-users-v1";
const SESSION_KEY = "trewel-session-v1";
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 150000;

export const DEMO_USER = {
  id: "u_demo",
  email: "s.chen@university.edu",
  name: "Dr. Sam Chen",
  password: "trewel-demo", // published demo credentials — sample workspace only
};

function loadUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || {};
  } catch {
    return {};
  }
}
function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (s && s.expiresAt > Date.now()) return s;
  } catch {
    /* invalid session */
  }
  return null;
}

// Non-hook accessor for modules (audit trail) that need the actor name.
export function getSessionEmail() {
  return loadSession()?.email || "practitioner";
}

function b64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}
function randomB64(len = 16) {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return b64(a);
}

async function derivePassword(password, saltB64, iterations = PBKDF2_ITERATIONS) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(saltB64), iterations, hash: "SHA-256" },
    keyMaterial, 256
  );
  return b64(bits);
}

function startSession(user) {
  const session = {
    token: randomB64(24),
    userId: user.id,
    email: user.email,
    name: user.name,
    expiresAt: Date.now() + SESSION_DAYS * 24 * 3600 * 1000,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

// Create the published demo account on first run so the sample workspace is
// one login away.
async function ensureDemoAccount() {
  const users = loadUsers();
  if (Object.values(users).some((u) => u.id === DEMO_USER.id)) return;
  const salt = randomB64();
  users[DEMO_USER.email] = {
    id: DEMO_USER.id,
    email: DEMO_USER.email,
    name: DEMO_USER.name,
    createdAt: Date.now(),
    credential: {
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: await derivePassword(DEMO_USER.password, salt),
    },
  };
  saveUsers(users);
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      await ensureDemoAccount();
      const session = loadSession();
      if (session) {
        setUser({ id: session.userId, email: session.email, name: session.name });
      }
      setReady(true);
    })();
  }, []);

  const value = useMemo(
    () => ({
      ready,
      user,
      async register(name, email, password) {
        const clean = email.trim().toLowerCase();
        if (!clean.includes("@")) throw new Error("Enter a valid email address.");
        if ((password || "").length < 8) throw new Error("Use a password of at least 8 characters.");
        const users = loadUsers();
        if (users[clean]) throw new Error("An account with that email already exists — sign in instead.");
        const salt = randomB64();
        const record = {
          id: `u_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e5).toString(36)}`,
          email: clean,
          name: name.trim() || clean.split("@")[0],
          createdAt: Date.now(),
          credential: { salt, iterations: PBKDF2_ITERATIONS, hash: await derivePassword(password, salt) },
        };
        users[clean] = record;
        saveUsers(users);
        startSession(record);
        setUser({ id: record.id, email: record.email, name: record.name });
        return record;
      },
      async login(email, password) {
        const clean = email.trim().toLowerCase();
        const users = loadUsers();
        const record = users[clean];
        if (!record) throw new Error("No account with that email. Create one first.");
        const hash = await derivePassword(password, record.credential.salt, record.credential.iterations);
        if (hash !== record.credential.hash) throw new Error("That password didn't match. Try again.");
        startSession(record);
        setUser({ id: record.id, email: record.email, name: record.name });
        return record;
      },
      logout() {
        localStorage.removeItem(SESSION_KEY);
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

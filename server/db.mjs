// ---------------------------------------------------------------------------
// Trewel database layer — Postgres (Neon, provisioned via Vercel's Storage
// tab), replacing the old browser-localStorage storage entirely. Every
// practitioner account, care plan, client code, and meal log now lives
// here, so any device can read it — not just the browser that created it.
//
// Connection: reads DATABASE_URL (or POSTGRES_URL — Vercel's Postgres/Neon
// integration has used both names across versions, so both are checked)
// from the environment via @neondatabase/serverless's `neon()` client,
// configured with `fullResults: true` so every query resolves to the
// familiar `{ rows: [...] }` shape. Works identically in the Vite dev
// middleware and the Vercel serverless functions, as long as the connection
// string is set in both places (Vercel injects it automatically once a
// Postgres database is attached to the project; locally it's copied into
// .env — see README for the exact steps).
//
// IMPORTANT: the client is built lazily, on first actual query, not at
// module-import time. vite.config.js's top-level imports (which pull this
// module in transitively) run BEFORE its `loadEnv()` call populates
// process.env, so anything read from process.env at this file's top level
// would permanently capture an empty value. Reading it inside `sql()`
// instead means it's always read at real query time, after env vars are
// actually loaded — the same class of bug already fixed once for the
// Gemini integration.
// ---------------------------------------------------------------------------

import { neon } from "@neondatabase/serverless";
import { randomBytes, scryptSync } from "node:crypto";

let cachedClient = null;
let cachedConnectionString = null;

function getClient() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString && !cachedClient) {
    console.warn("[trewel] No DATABASE_URL/POSTGRES_URL set — database calls will fail until it's configured.");
  }
  // Rebuild only if the connection string actually changed (or first call).
  if (!cachedClient || connectionString !== cachedConnectionString) {
    cachedConnectionString = connectionString;
    cachedClient = neon(connectionString || "postgresql://unset:unset@localhost/unset", { fullResults: true });
  }
  return cachedClient;
}

// Drop-in replacement for the old `export const sql = neon(...)` — same
// tagged-template call shape (`sql\`SELECT ...\``), just resolved lazily.
export function sql(strings, ...values) {
  return getClient()(strings, ...values);
}

let schemaReady = null;

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

const DEMO_ID = "u_demo";
const DEMO_EMAIL = "s.chen@university.edu";
const DEMO_NAME = "Dr. Sam Chen";
const DEMO_PASSWORD = "trewel-demo";

async function ensureDemoAccount() {
  const existing = await sql`SELECT id FROM practitioners WHERE id = ${DEMO_ID}`;
  if (existing.rows.length) return;
  const { hash, salt } = hashPassword(DEMO_PASSWORD);
  await sql`
    INSERT INTO practitioners (id, name, email, password_hash, password_salt)
    VALUES (${DEMO_ID}, ${DEMO_NAME}, ${DEMO_EMAIL}, ${hash}, ${salt})
    ON CONFLICT (id) DO NOTHING
  `;
  await sql`
    INSERT INTO settings (practitioner_id, retention_days, research_mode)
    VALUES (${DEMO_ID}, 90, false)
    ON CONFLICT (practitioner_id) DO NOTHING
  `;
}

// Idempotent schema creation — runs on cold start, cheap on warm invocations
// since it's a single round trip of "IF NOT EXISTS" statements. This means
// there is no manual migration step: the schema self-creates on first use.
export async function ensureSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS practitioners (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        practitioner_id TEXT NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        practitioner_id TEXT PRIMARY KEY REFERENCES practitioners(id) ON DELETE CASCADE,
        retention_days INT NOT NULL DEFAULT 90,
        research_mode BOOLEAN NOT NULL DEFAULT false
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS studies (
        id TEXT PRIMARY KEY,
        practitioner_id TEXT NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        code_prefix TEXT NOT NULL,
        surface TEXT NOT NULL DEFAULT 'care',
        protocol JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS participants (
        code TEXT PRIMARY KEY,
        study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS meals (
        id TEXT PRIMARY KEY,
        participant_code TEXT NOT NULL REFERENCES participants(code) ON DELETE CASCADE,
        ts BIGINT NOT NULL,
        photo TEXT,
        note TEXT NOT NULL DEFAULT '',
        engine TEXT,
        result JSONB NOT NULL,
        review JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        practitioner_id TEXT NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
        ts BIGINT NOT NULL,
        actor TEXT,
        action TEXT NOT NULL,
        target TEXT
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS waitlist_signups (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await ensureDemoAccount();
  })();
  return schemaReady;
}

export const DEMO_ACCOUNT = { id: DEMO_ID, email: DEMO_EMAIL, name: DEMO_NAME, password: DEMO_PASSWORD };

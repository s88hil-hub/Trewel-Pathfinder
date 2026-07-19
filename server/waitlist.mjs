// ---------------------------------------------------------------------------
// Trewel waitlist store — now backed by the real Postgres database instead
// of a local JSON file, so signups survive serverless cold starts and are
// visible from the admin panel regardless of which instance handled the
// request.
//
//   addSignup(email)  -> { ok, duplicate, total, error? }
//   listSignups()     -> [{ email, timestamp }]  (newest first)
//   countSignups()    -> number
// ---------------------------------------------------------------------------

import { sql, ensureSchema } from "./db.mjs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email) {
  return typeof email === "string" && email.length <= 254 && EMAIL_RE.test(email.trim());
}

export async function addSignup(rawEmail) {
  const email = String(rawEmail || "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  await ensureSchema();
  const existing = await sql`SELECT id FROM waitlist_signups WHERE email = ${email}`;
  if (existing.rows.length) {
    const { rows } = await sql`SELECT count(*)::int AS total FROM waitlist_signups`;
    return { ok: true, duplicate: true, total: rows[0].total };
  }
  await sql`INSERT INTO waitlist_signups (email) VALUES (${email})`;
  const { rows } = await sql`SELECT count(*)::int AS total FROM waitlist_signups`;
  return { ok: true, duplicate: false, total: rows[0].total };
}

export async function countSignups() {
  await ensureSchema();
  const { rows } = await sql`SELECT count(*)::int AS total FROM waitlist_signups`;
  return rows[0].total;
}

export async function listSignups() {
  await ensureSchema();
  const { rows } = await sql`SELECT email, created_at AS timestamp FROM waitlist_signups ORDER BY created_at DESC`;
  return rows;
}

// ---------------------------------------------------------------------------
// Server-side password hashing, cookies, and session helpers shared by the
// dev middleware (vite.config.js) and the Vercel serverless function
// (api/[...path].mjs), so both environments behave identically.
// ---------------------------------------------------------------------------

import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import { sql } from "./db.mjs";

const SESSION_COOKIE = "trewel_session";
const ADMIN_COOKIE = "trewel_admin";
const SESSION_DAYS = 30;
const ADMIN_SESSION_HOURS = 12;

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password, hash, salt) {
  const candidate = scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, "hex");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

export function parseCookies(req) {
  const header = req.headers?.cookie || "";
  const out = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function isSecureRequest() {
  // Vercel sets VERCEL=1 in every deployed runtime; local `vite` dev never does.
  return Boolean(process.env.VERCEL);
}

export function setCookie(res, name, value, { maxAgeSeconds } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (isSecureRequest()) parts.push("Secure");
  if (maxAgeSeconds != null) parts.push(`Max-Age=${maxAgeSeconds}`);
  const existing = res.getHeader("Set-Cookie");
  const next = existing ? [].concat(existing, parts.join("; ")) : [parts.join("; ")];
  res.setHeader("Set-Cookie", next);
}

export function clearCookie(res, name) {
  setCookie(res, name, "", { maxAgeSeconds: 0 });
}

/* ------------------------------------------------------------------ */
/* Practitioner sessions — real DB-backed rows, so logout genuinely     */
/* revokes access rather than relying on client-side expiry alone.      */
/* ------------------------------------------------------------------ */

export async function createSession(practitionerId) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  await sql`INSERT INTO sessions (token, practitioner_id, expires_at) VALUES (${token}, ${practitionerId}, ${expiresAt.toISOString()})`;
  return { token, maxAgeSeconds: SESSION_DAYS * 24 * 3600 };
}

export async function getPractitionerFromRequest(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const { rows } = await sql`
    SELECT p.id, p.name, p.email
    FROM sessions s
    JOIN practitioners p ON p.id = s.practitioner_id
    WHERE s.token = ${token} AND s.expires_at > now()
  `;
  return rows[0] || null;
}

export async function destroySession(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (token) await sql`DELETE FROM sessions WHERE token = ${token}`;
}

export { SESSION_COOKIE };

/* ------------------------------------------------------------------ */
/* Admin session — stateless HMAC-signed cookie, no DB table needed.   */
/* Good enough for a single shared admin password, per spec.           */
/* ------------------------------------------------------------------ */

function adminSecret() {
  return process.env.ADMIN_PASSWORD || "trewel-admin-fallback-secret";
}

export function issueAdminCookie(res) {
  const expiresAt = Date.now() + ADMIN_SESSION_HOURS * 3600 * 1000;
  const sig = createHmac("sha256", adminSecret()).update(`admin:${expiresAt}`).digest("hex");
  setCookie(res, ADMIN_COOKIE, `${expiresAt}.${sig}`, { maxAgeSeconds: ADMIN_SESSION_HOURS * 3600 });
}

export function isAdminRequest(req) {
  const cookies = parseCookies(req);
  const value = cookies[ADMIN_COOKIE];
  if (!value) return false;
  const [expiresAtStr, sig] = value.split(".");
  const expiresAt = Number(expiresAtStr);
  if (!expiresAt || expiresAt < Date.now()) return false;
  const expected = createHmac("sha256", adminSecret()).update(`admin:${expiresAt}`).digest("hex");
  const a = Buffer.from(sig || "", "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function clearAdminCookie(res) {
  clearCookie(res, ADMIN_COOKIE);
}

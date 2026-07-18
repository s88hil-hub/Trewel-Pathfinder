// ---------------------------------------------------------------------------
// Trewel waitlist store — persistent, file-backed signup storage.
//
//   addSignup(email)  -> { ok, duplicate, total, error? }
//   listSignups()     -> [{ email, timestamp }]
//   countSignups()    -> number
//
// Signups are appended to a JSON file that acts as the "waitlist_signups"
// table (each row is { email, timestamp }). This persists across dev-server
// restarts (the file lives on disk, not in memory) and is trivially
// inspectable / exportable.
//
// Storage location:
//   - Local dev: <project>/.data/waitlist.json  (gitignored, durable).
//   - Serverless (Vercel): the project dir is read-only, so it falls back to
//     the OS temp dir. That is durable within a warm instance but NOT across
//     cold starts — to make production storage durable, point WAITLIST_FILE at
//     a mounted volume, or swap the two fs calls below for a Vercel KV /
//     Postgres "waitlist_signups" table (a one-function change).
// ---------------------------------------------------------------------------

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function storeFile() {
  if (process.env.WAITLIST_FILE) return process.env.WAITLIST_FILE;
  // Prefer a project-local .data dir; fall back to temp when it's not writable
  // (e.g. a read-only serverless filesystem).
  const local = path.join(process.cwd(), ".data", "waitlist.json");
  return local;
}

async function readAll(file) {
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(file, rows) {
  const dir = path.dirname(file);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(rows, null, 2), "utf8");
}

// Resolve a writable file, degrading gracefully from project-local to temp.
async function resolveWritableFile() {
  const primary = storeFile();
  try {
    await fs.mkdir(path.dirname(primary), { recursive: true });
    return primary;
  } catch {
    return path.join(os.tmpdir(), "trewel-waitlist.json");
  }
}

export function isValidEmail(email) {
  return typeof email === "string" && email.length <= 254 && EMAIL_RE.test(email.trim());
}

export async function addSignup(rawEmail) {
  const email = String(rawEmail || "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  const file = await resolveWritableFile();
  const rows = await readAll(file);
  if (rows.some((r) => (r.email || "").toLowerCase() === email)) {
    return { ok: true, duplicate: true, total: rows.length };
  }
  rows.push({ email, timestamp: new Date().toISOString() });
  await writeAll(file, rows);
  return { ok: true, duplicate: false, total: rows.length };
}

export async function countSignups() {
  const file = await resolveWritableFile();
  const rows = await readAll(file);
  return rows.length;
}

export async function listSignups() {
  const file = await resolveWritableFile();
  return readAll(file);
}

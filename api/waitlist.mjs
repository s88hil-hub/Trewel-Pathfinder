// Vercel serverless function — production entry point for the waitlist.
// Mirrors what vite.config.js does for local dev (GET count / POST signup).
// The storage logic itself lives in server/waitlist.mjs.
//
// NOTE ON DURABILITY: on Vercel the project filesystem is read-only, so the
// store falls back to the instance temp dir — durable within a warm instance
// but not across cold starts. For durable production storage, set WAITLIST_FILE
// to a mounted volume, or swap server/waitlist.mjs's fs calls for a Vercel KV /
// Postgres "waitlist_signups" table.

import { addSignup, countSignups } from "../server/waitlist.mjs";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      res.status(200).json({ total: await countSignups() });
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const email = (req.body || {}).email;
    const result = await addSignup(email);
    res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    console.error("[trewel] waitlist failed:", err);
    res.status(500).json({ error: String(err?.message || err) });
  }
}

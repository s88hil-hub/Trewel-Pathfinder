// Vercel serverless function — production entry point for the AI matching
// module. Mirrors what vite.config.js does for local dev (POST /api/analyze-meal),
// but runs as a real hosted endpoint instead of Vite dev-server middleware.
// The matching logic itself is untouched — it all lives in server/analyzeMeal.mjs.

import { analyzeMeal } from "../server/analyzeMeal.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const result = await analyzeMeal(req.body || {});
    res.status(200).json(result);
  } catch (err) {
    console.error("[trewel] analyze-meal failed:", err);
    res.status(500).json({ error: String(err?.message || err) });
  }
}

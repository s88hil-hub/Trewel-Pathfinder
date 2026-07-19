// Single Vercel serverless function handling every /api/* route except the
// two existing explicit ones (analyze-meal.mjs, waitlist.mjs). Vercel's
// rewrite (see vercel.json) sends everything else here while preserving the
// ORIGINAL request URL on req.url, so this file dispatches purely on that —
// no dynamic filesystem routes needed at all.
//
// Deliberately kept to one file: the Hobby plan caps a deployment at 12
// serverless functions, and per-route files (one each for auth/workspace/
// participant/admin/etc.) blew past that. The actual routing logic already
// lives in server/appRouter.mjs and dispatches on the path string, so a
// single entry point is all that's needed here.
import { handleApiRequest } from "../server/appRouter.mjs";

export default async function handler(req, res) {
  const routePath = (req.url || "/").replace(/^\/api/, "") || "/";
  await handleApiRequest(req, res, routePath);
}

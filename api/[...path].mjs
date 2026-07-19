// Vercel serverless catch-all — handles every /api/* route except the two
// existing explicit functions (analyze-meal.mjs, waitlist.mjs), which Vercel
// matches first since they're more specific. Delegates to the shared router
// in server/appRouter.mjs so dev and production run identical logic.

import { handleApiRequest } from "../server/appRouter.mjs";

export default async function handler(req, res) {
  // Vercel does not strip the "/api" prefix for catch-all functions, so we
  // remove it here to match the route paths appRouter.mjs expects (see the
  // comment at the top of that file).
  const routePath = (req.url || "/").replace(/^\/api/, "") || "/";
  await handleApiRequest(req, res, routePath);
}

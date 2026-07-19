// Thin Vercel serverless entry point — delegates all routing/logic to the
// shared server/appRouter.mjs (used identically by the Vite dev middleware),
// so this file and every sibling under api/ are just dispatch shims.
import { handleApiRequest } from "../../../../server/appRouter.mjs";

export default async function handler(req, res) {
  const routePath = (req.url || "/").replace(/^\/api/, "") || "/";
  await handleApiRequest(req, res, routePath);
}

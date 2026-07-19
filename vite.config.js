import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { analyzeMeal } from "./server/analyzeMeal.mjs";
import { addSignup, countSignups } from "./server/waitlist.mjs";
import { handleApiRequest } from "./server/appRouter.mjs";

// Dev-server middleware exposing the AI matching module at POST /api/analyze-meal.
// The matching logic itself lives in server/analyzeMeal.mjs so it can be swapped
// out (or moved to a real backend) without touching the UI.
function trewelApiPlugin() {
  return {
    name: "trewel-api",
    configureServer(server) {
      server.middlewares.use("/api/analyze-meal", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
          try {
            const payload = JSON.parse(body || "{}");
            const result = await analyzeMeal(payload);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
          } catch (err) {
            console.error("[trewel] analyze-meal failed:", err);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: String(err?.message || err) }));
          }
        });
      });

      // Waitlist: GET returns the current signup count; POST adds a signup.
      server.middlewares.use("/api/waitlist", (req, res) => {
        res.setHeader("Content-Type", "application/json");
        if (req.method === "GET") {
          countSignups()
            .then((total) => res.end(JSON.stringify({ total })))
            .catch(() => res.end(JSON.stringify({ total: 0 })));
          return;
        }
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
          try {
            const { email } = JSON.parse(body || "{}");
            const result = await addSignup(email);
            if (!result.ok) res.statusCode = 400;
            res.end(JSON.stringify(result));
          } catch (err) {
            console.error("[trewel] waitlist failed:", err);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(err?.message || err) }));
          }
        });
      });

      // Everything else under /api (auth, workspace, participant, admin) is
      // handled by the shared server/appRouter.mjs — the exact same code
      // that runs on Vercel via api/[...path].mjs, so dev and prod behave
      // identically. Connect strips the "/api" mount prefix from req.url
      // before this handler runs, so routePath here is already e.g.
      // "/auth/login" (see the stripping note in appRouter.mjs).
      server.middlewares.use("/api", (req, res) => {
        handleApiRequest(req, res, req.url || "/").catch((err) => {
          console.error("[trewel] API error:", err);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: String(err?.message || err) }));
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Vite only auto-exposes VITE_-prefixed vars to client code via
  // import.meta.env. The analyze-meal middleware runs as plain Node code and
  // reads process.env directly, so .env must be loaded into process.env here.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  return {
    plugins: [react(), trewelApiPlugin()],
  };
});

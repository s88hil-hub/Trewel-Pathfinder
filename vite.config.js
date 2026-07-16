import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { analyzeMeal } from "./server/analyzeMeal.mjs";

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
    },
  };
}

export default defineConfig({
  plugins: [react(), trewelApiPlugin()],
});

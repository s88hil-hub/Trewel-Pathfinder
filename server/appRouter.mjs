// ---------------------------------------------------------------------------
// Trewel's server-side application router — auth, workspaces (care plans +
// clients + meal logs), participant lookup, and the admin panel. This is
// the real backend that replaces browser localStorage: every account, plan,
// client code, and meal now lives in Postgres and is reachable from any
// device.
//
// Shared between the Vite dev middleware (vite.config.js) and the Vercel
// serverless catch-all (api/[...path].mjs) via `handleApiRequest(req, res,
// routePath)`, where `routePath` is the request path with the leading
// "/api" already stripped by the caller (the two environments strip it
// differently, so each entry point does its own stripping — see comments
// at each call site).
// ---------------------------------------------------------------------------

import { sql, ensureSchema, DEMO_ACCOUNT } from "./db.mjs";
import {
  hashPassword, verifyPassword, createSession, getPractitionerFromRequest,
  destroySession, setCookie, clearCookie, SESSION_COOKIE,
  issueAdminCookie, isAdminRequest, clearAdminCookie,
} from "./authServer.mjs";
import { buildSeedData, makeParticipantCode } from "../src/lib/seed.js";
import { CORRECTION_SCORES } from "../src/lib/adherence.js";

function generateId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function getBody(req) {
  // Vercel's Node runtime pre-parses JSON bodies onto req.body; the Vite dev
  // middleware hands us a raw stream instead (see vite.config.js).
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") {
      try { return JSON.parse(req.body || "{}"); } catch { return {}; }
    }
    return req.body;
  }
  return await new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
    req.on("error", () => resolve({}));
  });
}

function parseJsonb(value) {
  if (value == null) return value;
  return typeof value === "string" ? JSON.parse(value) : value;
}

function auditEntry(id, ts, actor, action, target) {
  return { id, ts, actor, action, target };
}

/* ------------------------------------------------------------------ */
/* Workspace assembly — reads a practitioner's plans/clients/meals      */
/* into the same shape the UI already expects (unchanged from the old   */
/* localStorage version), so no page needed a redesign.                 */
/* ------------------------------------------------------------------ */
async function getWorkspaceForPractitioner(practitionerId) {
  const [studiesRes, participantsRes, mealsRes, settingsRes, auditRes] = await Promise.all([
    sql`SELECT id, name, description, code_prefix AS "codePrefix", surface, protocol, created_at AS "createdAt"
        FROM studies WHERE practitioner_id = ${practitionerId} ORDER BY created_at DESC`,
    sql`SELECT pt.code, pt.study_id AS "studyId", pt.joined_at AS "joinedAt"
        FROM participants pt JOIN studies st ON st.id = pt.study_id
        WHERE st.practitioner_id = ${practitionerId}`,
    sql`SELECT m.id, m.participant_code AS "participantCode", m.ts AS "timestamp", m.photo, m.note, m.engine, m.result, m.review
        FROM meals m
        JOIN participants pt ON pt.code = m.participant_code
        JOIN studies st ON st.id = pt.study_id
        WHERE st.practitioner_id = ${practitionerId}
        ORDER BY m.ts ASC`,
    sql`SELECT retention_days AS "retentionDays", research_mode AS "researchMode"
        FROM settings WHERE practitioner_id = ${practitionerId}`,
    sql`SELECT id, ts, actor, action, target FROM audit_log WHERE practitioner_id = ${practitionerId} ORDER BY ts ASC`,
  ]);

  const studies = {};
  for (const row of studiesRes.rows) {
    studies[row.id] = {
      id: row.id, name: row.name, description: row.description,
      codePrefix: row.codePrefix, surface: row.surface,
      protocol: parseJsonb(row.protocol),
      createdAt: new Date(row.createdAt).getTime(),
      participants: [],
    };
  }
  const participants = {};
  for (const row of participantsRes.rows) {
    participants[row.code] = {
      code: row.code, studyId: row.studyId,
      joinedAt: new Date(row.joinedAt).getTime(), meals: [],
    };
    if (studies[row.studyId]) studies[row.studyId].participants.push(row.code);
  }
  for (const row of mealsRes.rows) {
    const p = participants[row.participantCode];
    if (!p) continue;
    p.meals.push({
      id: row.id, timestamp: Number(row.timestamp), photo: row.photo,
      note: row.note, engine: row.engine,
      result: parseJsonb(row.result), review: parseJsonb(row.review),
    });
  }
  const settings = settingsRes.rows[0] || { retentionDays: 90, researchMode: false };
  const audit = auditRes.rows.map((r) => ({ id: r.id, ts: Number(r.ts), actor: r.actor, action: r.action, target: r.target }));

  return { studies, participants, settings, audit };
}

async function logAudit(practitionerId, action, target, actor) {
  await sql`INSERT INTO audit_log (id, practitioner_id, ts, actor, action, target)
    VALUES (${generateId("aud")}, ${practitionerId}, ${Date.now()}, ${actor || null}, ${action}, ${target || null})`;
}

async function insertParticipantWithUniqueCode(studyId, prefix) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeParticipantCode(prefix);
    try {
      await sql`INSERT INTO participants (code, study_id) VALUES (${code}, ${studyId})`;
      return code;
    } catch (err) {
      if (String(err?.message || "").toLowerCase().includes("duplicate key")) continue;
      throw err;
    }
  }
  throw new Error("Could not generate a unique client code — please try again.");
}

// Wipes and reseeds a practitioner's workspace with the deterministic demo
// dataset (used by "Load a sample workspace" and by resetting the demo
// account). Each study/participant gets freshly generated ids/codes so
// multiple practitioners loading the sample never collide with each other.
async function reseedSampleForPractitioner(practitionerId) {
  await sql`DELETE FROM studies WHERE practitioner_id = ${practitionerId}`;
  await sql`DELETE FROM audit_log WHERE practitioner_id = ${practitionerId}`;
  await sql`UPDATE settings SET retention_days = 90 WHERE practitioner_id = ${practitionerId}`;

  const seed = buildSeedData();
  for (const study of Object.values(seed.studies)) {
    const newStudyId = generateId("st");
    await sql`INSERT INTO studies (id, practitioner_id, name, description, code_prefix, surface, protocol, created_at)
      VALUES (${newStudyId}, ${practitionerId}, ${study.name}, ${study.description}, ${study.codePrefix}, ${study.surface},
              ${JSON.stringify(study.protocol)}, ${new Date(study.createdAt).toISOString()})`;
    for (const oldCode of study.participants) {
      const p = seed.participants[oldCode];
      const newCode = await insertParticipantWithUniqueCode(newStudyId, study.codePrefix);
      await sql`UPDATE participants SET joined_at = ${new Date(p.joinedAt).toISOString()} WHERE code = ${newCode}`;
      for (const meal of p.meals) {
        await sql`INSERT INTO meals (id, participant_code, ts, photo, note, engine, result, review)
          VALUES (${generateId("meal")}, ${newCode}, ${meal.timestamp}, ${meal.photo}, ${meal.note || ""}, ${meal.engine},
                  ${JSON.stringify(meal.result)}, ${JSON.stringify(meal.review)})`;
      }
    }
  }
  for (const entry of seed.audit) {
    await logAudit(practitionerId, entry.action, entry.target, entry.actor);
  }
  await logAudit(practitionerId, "Sample workspace loaded", "Demo plans and clients", null);
}

/* ------------------------------------------------------------------ */
/* Route handler                                                       */
/* ------------------------------------------------------------------ */
export async function handleApiRequest(req, res, routePath) {
  await ensureSchema();
  const method = req.method;
  const path = routePath.split("?")[0];
  let m;

  try {
    // ---------------- AUTH ----------------
    if (method === "POST" && path === "/auth/register") {
      const { name, email, password } = await getBody(req);
      const clean = String(email || "").trim().toLowerCase();
      if (!clean.includes("@")) return sendJson(res, 400, { error: "Enter a valid email address." });
      if (String(password || "").length < 8) return sendJson(res, 400, { error: "Use a password of at least 8 characters." });
      const existing = await sql`SELECT id FROM practitioners WHERE email = ${clean}`;
      if (existing.rows.length) return sendJson(res, 400, { error: "An account with that email already exists — sign in instead." });
      const id = generateId("u");
      const { hash, salt } = hashPassword(password);
      const displayName = (name || "").trim() || clean.split("@")[0];
      await sql`INSERT INTO practitioners (id, name, email, password_hash, password_salt) VALUES (${id}, ${displayName}, ${clean}, ${hash}, ${salt})`;
      await sql`INSERT INTO settings (practitioner_id) VALUES (${id})`;
      const session = await createSession(id);
      setCookie(res, SESSION_COOKIE, session.token, { maxAgeSeconds: session.maxAgeSeconds });
      return sendJson(res, 200, { user: { id, name: displayName, email: clean } });
    }

    if (method === "POST" && path === "/auth/login") {
      const { email, password } = await getBody(req);
      const clean = String(email || "").trim().toLowerCase();
      const { rows } = await sql`SELECT id, name, email, password_hash, password_salt FROM practitioners WHERE email = ${clean}`;
      const record = rows[0];
      if (!record) return sendJson(res, 400, { error: "No account with that email. Create one first." });
      if (!verifyPassword(password || "", record.password_hash, record.password_salt)) {
        return sendJson(res, 400, { error: "That password didn't match. Try again." });
      }
      const session = await createSession(record.id);
      setCookie(res, SESSION_COOKIE, session.token, { maxAgeSeconds: session.maxAgeSeconds });
      return sendJson(res, 200, { user: { id: record.id, name: record.name, email: record.email } });
    }

    if (method === "POST" && path === "/auth/logout") {
      await destroySession(req);
      clearCookie(res, SESSION_COOKIE);
      return sendJson(res, 200, { ok: true });
    }

    if (method === "GET" && path === "/auth/me") {
      const practitioner = await getPractitionerFromRequest(req);
      return sendJson(res, 200, { user: practitioner || null });
    }

    // ---------------- WORKSPACE (practitioner session required) ----------------
    if (path.startsWith("/workspace") || (method === "POST" && path.startsWith("/meals/"))) {
      const practitioner = await getPractitionerFromRequest(req);
      if (!practitioner) return sendJson(res, 401, { error: "Not signed in." });

      if (method === "GET" && path === "/workspace") {
        return sendJson(res, 200, await getWorkspaceForPractitioner(practitioner.id));
      }

      if (method === "POST" && path === "/workspace/studies") {
        const { name, description, codePrefix, surface, protocol } = await getBody(req);
        const id = generateId("st");
        await sql`INSERT INTO studies (id, practitioner_id, name, description, code_prefix, surface, protocol)
          VALUES (${id}, ${practitioner.id}, ${name}, ${description || ""}, ${codePrefix}, ${surface || "care"}, ${JSON.stringify(protocol || {})})`;
        await logAudit(practitioner.id, "Plan created", name, practitioner.email);
        return sendJson(res, 200, { id, workspace: await getWorkspaceForPractitioner(practitioner.id) });
      }

      if ((m = path.match(/^\/workspace\/studies\/([^/]+)\/participants$/)) && method === "POST") {
        const studyId = m[1];
        const { rows } = await sql`SELECT code_prefix AS "codePrefix", name FROM studies WHERE id = ${studyId} AND practitioner_id = ${practitioner.id}`;
        if (!rows.length) return sendJson(res, 404, { error: "Plan not found." });
        const code = await insertParticipantWithUniqueCode(studyId, rows[0].codePrefix);
        await logAudit(practitioner.id, "Client enrolled", `${code} · ${rows[0].name.split("·")[0].trim()}`, practitioner.email);
        return sendJson(res, 200, { code, workspace: await getWorkspaceForPractitioner(practitioner.id) });
      }

      if (method === "POST" && path === "/workspace/settings") {
        const patch = await getBody(req);
        const fields = [];
        if (patch.retentionDays != null) fields.push(sql`retention_days = ${patch.retentionDays}`);
        if (patch.researchMode != null) fields.push(sql`research_mode = ${patch.researchMode}`);
        if (patch.retentionDays != null && patch.researchMode != null) {
          await sql`UPDATE settings SET retention_days = ${patch.retentionDays}, research_mode = ${patch.researchMode} WHERE practitioner_id = ${practitioner.id}`;
        } else if (patch.retentionDays != null) {
          await sql`UPDATE settings SET retention_days = ${patch.retentionDays} WHERE practitioner_id = ${practitioner.id}`;
        } else if (patch.researchMode != null) {
          await sql`UPDATE settings SET research_mode = ${patch.researchMode} WHERE practitioner_id = ${practitioner.id}`;
        }
        await logAudit(practitioner.id, "Settings changed", Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(", "), practitioner.email);
        return sendJson(res, 200, { workspace: await getWorkspaceForPractitioner(practitioner.id) });
      }

      if (method === "POST" && path === "/workspace/audit") {
        const { action, target, actor } = await getBody(req);
        await logAudit(practitioner.id, action, target, actor || practitioner.email);
        return sendJson(res, 200, { ok: true, workspace: await getWorkspaceForPractitioner(practitioner.id) });
      }

      if (method === "POST" && path === "/workspace/sample") {
        await reseedSampleForPractitioner(practitioner.id);
        return sendJson(res, 200, { workspace: await getWorkspaceForPractitioner(practitioner.id) });
      }

      if (method === "POST" && path === "/workspace/reset") {
        if (practitioner.id === DEMO_ACCOUNT.id) {
          await reseedSampleForPractitioner(practitioner.id);
        } else {
          await sql`DELETE FROM studies WHERE practitioner_id = ${practitioner.id}`;
          await sql`DELETE FROM audit_log WHERE practitioner_id = ${practitioner.id}`;
          await logAudit(practitioner.id, "Workspace data deleted", "All plans, clients, and meal logs", practitioner.email);
        }
        return sendJson(res, 200, { workspace: await getWorkspaceForPractitioner(practitioner.id) });
      }

      if ((m = path.match(/^\/meals\/([^/]+)\/([^/]+)\/review$/)) && method === "POST") {
        const [, code, mealId] = m;
        const { action, newStatus } = await getBody(req);
        const { rows } = await sql`
          SELECT m.result, st.practitioner_id AS "practitionerId"
          FROM meals m JOIN participants pt ON pt.code = m.participant_code JOIN studies st ON st.id = pt.study_id
          WHERE m.id = ${mealId} AND pt.code = ${code}`;
        if (!rows.length || rows[0].practitionerId !== practitioner.id) return sendJson(res, 404, { error: "Meal not found." });
        const result = parseJsonb(rows[0].result);
        let review;
        if (action === "confirm") {
          review = { state: "confirmed", reviewedAt: Date.now(), by: practitioner.email };
        } else {
          const original = { status: result.match_status, score: result.score };
          result.match_status = newStatus;
          result.score = CORRECTION_SCORES[newStatus];
          review = { state: "corrected", reviewedAt: Date.now(), by: practitioner.email, original };
        }
        await sql`UPDATE meals SET result = ${JSON.stringify(result)}, review = ${JSON.stringify(review)} WHERE id = ${mealId}`;
        await logAudit(practitioner.id, action === "confirm" ? "Confirmed AI match" : "Corrected AI match", `${code} · meal ${mealId.slice(-6)}`, practitioner.email);
        return sendJson(res, 200, { workspace: await getWorkspaceForPractitioner(practitioner.id) });
      }

      return sendJson(res, 404, { error: "Not found." });
    }

    // ---------------- PARTICIPANT (public — code is the credential) ----------------
    if ((m = path.match(/^\/participant\/([^/]+)$/)) && method === "GET") {
      const code = decodeURIComponent(m[1]);
      const { rows } = await sql`
        SELECT pt.code, pt.study_id AS "studyId", pt.joined_at AS "joinedAt",
               st.name, st.description, st.code_prefix AS "codePrefix", st.surface, st.protocol, st.created_at AS "createdAt"
        FROM participants pt JOIN studies st ON st.id = pt.study_id
        WHERE pt.code = ${code}`;
      if (!rows.length) return sendJson(res, 404, { error: "That code didn't match an active plan." });
      const row = rows[0];
      const mealsRes = await sql`SELECT id, ts AS "timestamp", photo, note, engine, result, review FROM meals WHERE participant_code = ${code} ORDER BY ts ASC`;
      const meals = mealsRes.rows.map((r) => ({
        id: r.id, timestamp: Number(r.timestamp), photo: r.photo, note: r.note, engine: r.engine,
        result: parseJsonb(r.result), review: parseJsonb(r.review),
      }));
      return sendJson(res, 200, {
        participant: { code: row.code, studyId: row.studyId, joinedAt: new Date(row.joinedAt).getTime(), meals },
        study: {
          id: row.studyId, name: row.name, description: row.description, codePrefix: row.codePrefix,
          surface: row.surface, protocol: parseJsonb(row.protocol), createdAt: new Date(row.createdAt).getTime(),
        },
      });
    }

    if ((m = path.match(/^\/participant\/([^/]+)\/meals$/)) && method === "POST") {
      const code = decodeURIComponent(m[1]);
      const { photo, note, engine, result } = await getBody(req);
      const { rows } = await sql`
        SELECT st.practitioner_id AS "practitionerId"
        FROM participants pt JOIN studies st ON st.id = pt.study_id
        WHERE pt.code = ${code}`;
      if (!rows.length) return sendJson(res, 404, { error: "That code didn't match an active plan." });
      const review = result?.confidence === "low" ? { state: "pending" } : { state: "auto_confirmed" };
      const id = generateId("meal");
      const ts = Date.now();
      await sql`INSERT INTO meals (id, participant_code, ts, photo, note, engine, result, review)
        VALUES (${id}, ${code}, ${ts}, ${photo || null}, ${note || ""}, ${engine}, ${JSON.stringify(result)}, ${JSON.stringify(review)})`;
      await logAudit(rows[0].practitionerId, "Meal logged", `${code} · ${review.state === "pending" ? "held for review" : "auto-verified"}`, code);
      return sendJson(res, 200, { meal: { id, timestamp: ts, photo: photo || null, note: note || "", engine, result, review } });
    }

    if (method === "GET" && path === "/participant-codes") {
      const { rows } = await sql`SELECT code FROM participants`;
      return sendJson(res, 200, { codes: rows.map((r) => r.code) });
    }

    // ---------------- ADMIN ----------------
    if (method === "POST" && path === "/admin/login") {
      const { password } = await getBody(req);
      if (!process.env.ADMIN_PASSWORD) return sendJson(res, 503, { error: "Admin access isn't configured yet (ADMIN_PASSWORD not set)." });
      if (password !== process.env.ADMIN_PASSWORD) return sendJson(res, 401, { error: "Incorrect password." });
      issueAdminCookie(res);
      return sendJson(res, 200, { ok: true });
    }

    if (method === "POST" && path === "/admin/logout") {
      clearAdminCookie(res);
      return sendJson(res, 200, { ok: true });
    }

    if (path.startsWith("/admin/") && method === "GET") {
      if (!isAdminRequest(req)) return sendJson(res, 401, { error: "Admin sign-in required." });

      if (path === "/admin/waitlist") {
        const { listSignups } = await import("./waitlist.mjs");
        return sendJson(res, 200, { signups: await listSignups() });
      }

      if (path === "/admin/practitioners") {
        const { rows } = await sql`
          SELECT p.id, p.name, p.email, p.created_at AS "createdAt",
            (SELECT count(*)::int FROM studies s WHERE s.practitioner_id = p.id) AS "planCount",
            (SELECT count(*)::int FROM participants pt JOIN studies s2 ON s2.id = pt.study_id WHERE s2.practitioner_id = p.id) AS "clientCount"
          FROM practitioners p ORDER BY p.created_at DESC`;
        return sendJson(res, 200, {
          practitioners: rows.map((r) => ({ ...r, createdAt: new Date(r.createdAt).getTime() })),
        });
      }
    }

    return sendJson(res, 404, { error: "Not found." });
  } catch (err) {
    console.error("[trewel] API error:", err);
    return sendJson(res, 500, { error: String(err?.message || err) });
  }
}

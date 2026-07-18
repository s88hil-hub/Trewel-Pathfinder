import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { buildSeedData, makeParticipantCode, SEED_VERSION } from "./seed.js";
import { CORRECTION_SCORES } from "./adherence.js";
import { useAuth, getSessionEmail, DEMO_USER } from "./auth.jsx";

// ---------------------------------------------------------------------------
// Multi-workspace store. Every practitioner account owns one workspace
// (plans/studies, clients/participants, meal logs, audit trail, settings),
// persisted under its own localStorage key so it survives refreshes and new
// sessions. Client-side participants are looked up across all workspaces by
// their invite code — the code is their only credential.
// ---------------------------------------------------------------------------

const WS_PREFIX = "trewel-ws-";
const LEGACY_KEY = "trewel-data-v1"; // pre-auth single-workspace storage

const StoreContext = createContext(null);

export function emptyWorkspace() {
  return {
    version: SEED_VERSION,
    seededAt: Date.now(),
    studies: {},
    participants: {},
    audit: [],
    settings: { retentionDays: 90, researchMode: false },
  };
}

function normalize(ws) {
  ws.settings = { retentionDays: 90, researchMode: false, ...(ws.settings || {}) };
  ws.audit = ws.audit || [];
  return ws;
}

function loadWorkspaces() {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(WS_PREFIX)) continue;
    try {
      const ws = JSON.parse(localStorage.getItem(k));
      if (ws && ws.version === SEED_VERSION) out[k.slice(WS_PREFIX.length)] = normalize(ws);
    } catch {
      /* skip corrupt workspace */
    }
  }
  // First run: give the demo account its sample workspace — adopting any
  // pre-auth data so nothing a user built earlier is lost.
  if (!out[DEMO_USER.id]) {
    let adopted = null;
    try {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY));
      if (legacy && legacy.version === SEED_VERSION) adopted = legacy;
    } catch {
      /* no legacy data */
    }
    out[DEMO_USER.id] = normalize(adopted || buildSeedData());
  }
  return out;
}

function auditEntry(action, target, actor) {
  return {
    id: `aud_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e5)}`,
    ts: Date.now(),
    actor: actor || getSessionEmail(),
    action,
    target,
  };
}

export function StoreProvider({ children }) {
  const [workspaces, setWorkspaces] = useState(loadWorkspaces);

  useEffect(() => {
    try {
      for (const [id, ws] of Object.entries(workspaces)) {
        localStorage.setItem(WS_PREFIX + id, JSON.stringify(ws));
      }
    } catch (err) {
      console.warn("[trewel] could not persist workspaces:", err);
    }
  }, [workspaces]);

  const actions = useMemo(() => {
    // Immutable update of one workspace.
    const patch = (wsId, fn) =>
      setWorkspaces((all) => {
        const ws = all[wsId] || emptyWorkspace();
        return { ...all, [wsId]: fn(ws) };
      });

    return {
      createStudy(wsId, study) {
        const id = `st_${Date.now().toString(36)}`;
        patch(wsId, (ws) => ({
          ...ws,
          studies: { ...ws.studies, [id]: { ...study, id, createdAt: Date.now(), participants: [] } },
          audit: [...ws.audit, auditEntry("Plan created", study.name)],
        }));
        return id;
      },
      addParticipant(wsId, studyId) {
        let code;
        patch(wsId, (ws) => {
          const study = ws.studies[studyId];
          do {
            code = makeParticipantCode(study.codePrefix || "TRW");
          } while (ws.participants[code]);
          return {
            ...ws,
            studies: {
              ...ws.studies,
              [studyId]: { ...study, participants: [...study.participants, code] },
            },
            participants: {
              ...ws.participants,
              [code]: { code, studyId, joinedAt: Date.now(), meals: [] },
            },
            audit: [...ws.audit, auditEntry("Client enrolled", `${code} · ${study.name.split("·")[0].trim()}`)],
          };
        });
        return code;
      },
      addMeal(wsId, code, meal) {
        // Trust rule: a low-confidence match is held for human review and does
        // not count toward adherence until the practitioner confirms it.
        const review =
          meal.result?.confidence === "low" ? { state: "pending" } : { state: "auto_confirmed" };
        const withReview = { ...meal, review };
        patch(wsId, (ws) => {
          const p = ws.participants[code];
          if (!p) return ws;
          return {
            ...ws,
            participants: { ...ws.participants, [code]: { ...p, meals: [...p.meals, withReview] } },
            audit: [
              ...ws.audit,
              auditEntry("Meal logged", `${code} · ${review.state === "pending" ? "held for review" : "auto-verified"}`, code),
            ],
          };
        });
        return withReview;
      },
      reviewMeal(wsId, code, mealId, { action, newStatus }) {
        const reviewer = getSessionEmail();
        patch(wsId, (ws) => {
          const p = ws.participants[code];
          if (!p) return ws;
          const meals = p.meals.map((m) => {
            if (m.id !== mealId) return m;
            if (action === "confirm") {
              return { ...m, review: { state: "confirmed", reviewedAt: Date.now(), by: reviewer } };
            }
            const original = { status: m.result.match_status, score: m.result.score };
            return {
              ...m,
              result: { ...m.result, match_status: newStatus, score: CORRECTION_SCORES[newStatus] },
              review: { state: "corrected", reviewedAt: Date.now(), by: reviewer, original },
            };
          });
          return {
            ...ws,
            participants: { ...ws.participants, [code]: { ...p, meals } },
            audit: [
              ...ws.audit,
              auditEntry(action === "confirm" ? "Confirmed AI match" : "Corrected AI match", `${code} · meal ${mealId.slice(-6)}`, reviewer),
            ],
          };
        });
      },
      updateSettings(wsId, patchObj) {
        patch(wsId, (ws) => ({
          ...ws,
          settings: { ...ws.settings, ...patchObj },
          audit: [
            ...ws.audit,
            auditEntry("Settings changed", Object.entries(patchObj).map(([k, v]) => `${k}=${v}`).join(", ")),
          ],
        }));
      },
      logAudit(wsId, action, target, actor) {
        patch(wsId, (ws) => ({ ...ws, audit: [...ws.audit, auditEntry(action, target, actor)] }));
      },
      loadSample(wsId) {
        patch(wsId, (ws) => {
          const sample = normalize(buildSeedData());
          sample.settings = { ...sample.settings, researchMode: ws.settings.researchMode };
          sample.audit = [...sample.audit, auditEntry("Sample workspace loaded", "Demo plans and clients")];
          return sample;
        });
      },
      resetWorkspace(wsId) {
        patch(wsId, (ws) => {
          const fresh = wsId === DEMO_USER.id ? normalize(buildSeedData()) : emptyWorkspace();
          fresh.settings = { ...fresh.settings, researchMode: ws.settings.researchMode };
          fresh.audit = [...fresh.audit, auditEntry("Workspace data deleted", "All plans, clients, and meal logs")];
          return fresh;
        });
      },
    };
  }, []);

  const value = useMemo(() => ({ workspaces, ...actions }), [workspaces, actions]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// Practitioner-facing hook: the signed-in user's workspace, with actions
// pre-bound to it. Page code stays oblivious to multi-workspace mechanics.
// ---------------------------------------------------------------------------
export function useWorkspace() {
  const { user } = useAuth();
  const ctx = useStore();
  const wsId = user?.id;
  const data = (wsId && ctx.workspaces[wsId]) || emptyWorkspace();
  return useMemo(
    () => ({
      wsId,
      data,
      createStudy: (study) => ctx.createStudy(wsId, study),
      addParticipant: (studyId) => ctx.addParticipant(wsId, studyId),
      reviewMeal: (code, mealId, decision) => ctx.reviewMeal(wsId, code, mealId, decision),
      updateSettings: (patchObj) => ctx.updateSettings(wsId, patchObj),
      logAudit: (action, target, actor) => ctx.logAudit(wsId, action, target, actor),
      loadSample: () => ctx.loadSample(wsId),
      resetWorkspace: () => ctx.resetWorkspace(wsId),
    }),
    [ctx, wsId, data]
  );
}

// ---------------------------------------------------------------------------
// Client-side lookup: find a participant by invite code across every
// workspace (the code is the client's only credential — no account needed).
// ---------------------------------------------------------------------------
export function useParticipantLookup(code) {
  const ctx = useStore();
  return useMemo(() => {
    for (const [wsId, ws] of Object.entries(ctx.workspaces)) {
      const participant = ws.participants[code];
      if (participant) {
        return {
          wsId,
          participant,
          study: ws.studies[participant.studyId] || null,
          settings: ws.settings,
          addMeal: (meal) => ctx.addMeal(wsId, code, meal),
        };
      }
    }
    return null;
  }, [ctx, code]);
}

// All participant codes across workspaces (join-page demo hints).
export function useAllParticipantCodes() {
  const ctx = useStore();
  return useMemo(
    () => Object.values(ctx.workspaces).flatMap((ws) => Object.keys(ws.participants)),
    [ctx.workspaces]
  );
}

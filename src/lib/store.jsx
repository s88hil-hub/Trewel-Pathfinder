import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { buildSeedData, makeParticipantCode, SEED_VERSION } from "./seed.js";
import { CORRECTION_SCORES } from "./adherence.js";

const STORAGE_KEY = "trewel-data-v1";
const StoreContext = createContext(null);

export function currentResearcher() {
  return sessionStorage.getItem("trewel-researcher-email") || "researcher";
}

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === SEED_VERSION) return parsed;
    }
  } catch {
    /* fall through to reseed */
  }
  return buildSeedData();
}

function auditEntry(actor, action, target) {
  return {
    id: `aud_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e5)}`,
    ts: Date.now(),
    actor,
    action,
    target,
  };
}

export function StoreProvider({ children }) {
  const [data, setData] = useState(loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      // localStorage quota — most likely large photos. Keep the app running.
      console.warn("[trewel] could not persist data:", err);
    }
  }, [data]);

  const actions = useMemo(
    () => ({
      createStudy(study) {
        const id = `st_${Date.now().toString(36)}`;
        const full = { ...study, id, createdAt: Date.now(), participants: [] };
        setData((d) => ({
          ...d,
          studies: { ...d.studies, [id]: full },
          audit: [...(d.audit || []), auditEntry(currentResearcher(), "Study created", full.name)],
        }));
        return id;
      },
      addParticipant(studyId) {
        let code;
        setData((d) => {
          const study = d.studies[studyId];
          do {
            code = makeParticipantCode(study.codePrefix || "TRW");
          } while (d.participants[code]);
          const participant = { code, studyId, joinedAt: Date.now(), meals: [] };
          return {
            ...d,
            studies: {
              ...d.studies,
              [studyId]: { ...study, participants: [...study.participants, code] },
            },
            participants: { ...d.participants, [code]: participant },
            audit: [...(d.audit || []), auditEntry(currentResearcher(), "Participant enrolled", `${code} · ${study.name.split("·")[0].trim()}`)],
          };
        });
        return code;
      },
      addMeal(code, meal) {
        // Trust rule: a low-confidence match is held for human review and does
        // not count toward adherence until a researcher confirms or corrects it.
        const review =
          meal.result?.confidence === "low"
            ? { state: "pending" }
            : { state: "auto_confirmed" };
        const withReview = { ...meal, review };
        setData((d) => {
          const p = d.participants[code];
          if (!p) return d;
          return {
            ...d,
            participants: {
              ...d.participants,
              [code]: { ...p, meals: [...p.meals, withReview] },
            },
            audit: [...(d.audit || []), auditEntry(code, "Meal logged", `${code} · ${review.state === "pending" ? "held for review" : "auto-verified"}`)],
          };
        });
        return withReview;
      },
      // Researcher review actions. Confirming keeps the AI's proposal;
      // correcting replaces the status (score = that band's midpoint) and
      // preserves the AI's original proposal for the audit trail.
      reviewMeal(code, mealId, { action, newStatus }) {
        const reviewer = currentResearcher();
        setData((d) => {
          const p = d.participants[code];
          if (!p) return d;
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
            ...d,
            participants: { ...d.participants, [code]: { ...p, meals } },
            audit: [
              ...(d.audit || []),
              auditEntry(
                reviewer,
                action === "confirm" ? "Confirmed AI match" : "Corrected AI match",
                `${code} · meal ${mealId.slice(-6)}`
              ),
            ],
          };
        });
      },
      updateSettings(patch) {
        setData((d) => ({
          ...d,
          settings: { ...(d.settings || {}), ...patch },
          audit: [
            ...(d.audit || []),
            auditEntry(currentResearcher(), "Settings changed", Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(", ")),
          ],
        }));
      },
      logAudit(action, target, actor) {
        setData((d) => ({
          ...d,
          audit: [...(d.audit || []), auditEntry(actor || currentResearcher(), action, target)],
        }));
      },
      resetDemo() {
        const fresh = buildSeedData();
        fresh.audit = [...fresh.audit, auditEntry(currentResearcher(), "Demo data reset", "All studies reseeded")];
        setData(fresh);
      },
    }),
    []
  );

  const value = useMemo(() => ({ data, ...actions }), [data, actions]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

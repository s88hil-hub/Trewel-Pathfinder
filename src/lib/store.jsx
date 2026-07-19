import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "./auth.jsx";

// ---------------------------------------------------------------------------
// Practitioner workspace — care plans, clients, meal logs, audit log, and
// settings. This now lives in Postgres behind /api/workspace/* (see
// server/appRouter.mjs), not in browser localStorage, so a plan or client
// code created on one device is immediately visible from any other device.
//
// The shape returned by useWorkspace() is unchanged from the old
// localStorage version on purpose — every page that reads `data.studies`,
// `data.participants`, `data.settings`, `data.audit` keeps working exactly
// as before. Only the mutating actions changed: they're now async (a real
// network request), so call sites that need the result (e.g. a newly
// created study's id) must await them.
// ---------------------------------------------------------------------------

function emptyWorkspace() {
  return { studies: {}, participants: {}, settings: { retentionDays: 90, researchMode: false }, audit: [] };
}

async function apiGet(path) {
  const res = await fetch(`/api${path}`, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
async function apiPost(path, body) {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const { user, ready } = useAuth();
  const [data, setData] = useState(emptyWorkspace());

  const refetch = useCallback(async () => {
    if (!user) { setData(emptyWorkspace()); return; }
    try {
      setData(await apiGet("/workspace"));
    } catch {
      /* keep last-known data on transient failure */
    }
  }, [user]);

  useEffect(() => {
    if (!ready) return;
    refetch();
  }, [ready, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const actions = useMemo(
    () => ({
      async createStudy(study) {
        const res = await apiPost("/workspace/studies", study);
        setData(res.workspace);
        return res.id;
      },
      async addParticipant(studyId) {
        const res = await apiPost(`/workspace/studies/${studyId}/participants`, {});
        setData(res.workspace);
        return res.code;
      },
      async reviewMeal(code, mealId, decision) {
        const res = await apiPost(`/meals/${code}/${mealId}/review`, decision);
        setData(res.workspace);
      },
      async updateSettings(patch) {
        const res = await apiPost("/workspace/settings", patch);
        setData(res.workspace);
      },
      async logAudit(action, target, actor) {
        const res = await apiPost("/workspace/audit", { action, target, actor });
        setData(res.workspace);
      },
      async loadSample() {
        const res = await apiPost("/workspace/sample", {});
        setData(res.workspace);
      },
      async resetWorkspace() {
        const res = await apiPost("/workspace/reset", {});
        setData(res.workspace);
      },
    }),
    []
  );

  const value = useMemo(() => ({ data, ...actions }), [data, actions]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

// Raw store access — used directly right after register/login (before the
// next workspace refetch would naturally happen) to log the sign-in event.
export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

// Practitioner-facing hook: the signed-in user's workspace, with actions
// pre-bound to it. Page code stays oblivious to server/network mechanics.
export function useWorkspace() {
  const { user } = useAuth();
  const ctx = useStore();
  return useMemo(() => ({ wsId: user?.id, ...ctx }), [user, ctx]);
}

// ---------------------------------------------------------------------------
// Client-side lookup: find a participant by invite code on the server (the
// code is the client's only credential — no account needed). Async, since
// this is now a real network request rather than a synchronous localStorage
// read; callers should check `loading` before treating a null result as
// "not found".
// ---------------------------------------------------------------------------
export function useParticipantLookup(code) {
  const [state, setState] = useState({ loading: true, participant: null, study: null });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, participant: null, study: null });
    if (!code) { setState({ loading: false, participant: null, study: null }); return; }
    fetch(`/api/participant/${encodeURIComponent(code)}`)
      .then(async (res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled) return;
        setState({ loading: false, participant: body?.participant || null, study: body?.study || null });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, participant: null, study: null });
      });
    return () => { cancelled = true; };
  }, [code]);

  const addMeal = useCallback(
    async (meal) => {
      const res = await apiPost(`/participant/${encodeURIComponent(code)}/meals`, meal);
      setState((s) => (s.participant ? { ...s, participant: { ...s.participant, meals: [...s.participant.meals, res.meal] } } : s));
      return res.meal;
    },
    [code]
  );

  if (state.loading) return { loading: true };
  if (!state.participant) return null;
  return { participant: state.participant, study: state.study, addMeal };
}

// All participant codes across every practitioner (join-page demo hints).
export function useAllParticipantCodes() {
  const [codes, setCodes] = useState([]);
  useEffect(() => {
    fetch("/api/participant-codes")
      .then((r) => r.json())
      .then((body) => setCodes(body.codes || []))
      .catch(() => setCodes([]));
  }, []);
  return codes;
}

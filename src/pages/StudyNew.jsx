import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout, ResearcherNav, useLingo, usePendingCount, practitionerTabs } from "../components/ui.jsx";
import { useWorkspace } from "../lib/store.jsx";
import { PROTOCOL_LIBRARY, CONDITION_LIBRARY, makeTemplateId } from "../lib/protocolTemplates.js";
import { downloadFile } from "../lib/exports.js";

function TagInput({ id, value, onChange, placeholder }) {
  const [draft, setDraft] = useState("");
  function commit() {
    const v = draft.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setDraft("");
  }
  return (
    <div>
      <input
        id={id}
        className="input"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={commit}
      />
      {value.length ? (
        <div className="tags">
          {value.map((t) => (
            <span key={t} className="tag">
              {t}
              <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>×</button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const EMPTY_FORM = {
  dietName: "", summary: "", calMin: "", calMax: "", sodium: "",
  carbs: "", protein: "", fat: "", emphasize: [], limit: [], excluded: [], notes: "",
};

export default function StudyNew() {
  const { data, createStudy } = useWorkspace();
  const navigate = useNavigate();
  const lingo = useLingo();
  const pending = usePendingCount();
  const researchMode = data.settings.researchMode;
  const LIBRARY = researchMode ? PROTOCOL_LIBRARY : CONDITION_LIBRARY;

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [codePrefix, setCodePrefix] = useState("");
  const [description, setDescription] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [responseTemplates, setResponseTemplates] = useState([]);
  const [activeTemplate, setActiveTemplate] = useState(null); // null = nothing picked yet
  const [showAdvanced, setShowAdvanced] = useState(false);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const setEv = (k) => (e) => set(k)(e.target.value);

  function applyLibraryTemplate(entry) {
    setActiveTemplate(entry ? entry.id : "blank");
    if (!entry) {
      setForm(EMPTY_FORM);
      setResponseTemplates([]);
      return;
    }
    const p = entry.protocol;
    setForm({
      dietName: p.dietName || "",
      summary: p.summary || "",
      calMin: p.caloriesPerMealMin ?? "",
      calMax: p.caloriesPerMealMax ?? "",
      sodium: p.sodiumLimitMg ?? "",
      carbs: p.macros?.carbs ?? "",
      protein: p.macros?.protein ?? "",
      fat: p.macros?.fat ?? "",
      emphasize: [...(p.emphasize || [])],
      limit: [...(p.limit || [])],
      excluded: [...(p.excludedFoods || [])],
      notes: p.notes || "",
    });
    setResponseTemplates((p.responseTemplates || []).map((t) => ({ ...t, keywords: [...(t.keywords || [])] })));
    if (!codePrefix) setCodePrefix(entry.codePrefix);
  }

  function buildProtocol() {
    return {
      dietName: form.dietName.trim(),
      summary: form.summary.trim(),
      caloriesPerMealMin: form.calMin ? Number(form.calMin) : null,
      caloriesPerMealMax: form.calMax ? Number(form.calMax) : null,
      sodiumLimitMg: form.sodium ? Number(form.sodium) : null,
      macros: {
        carbs: form.carbs ? Number(form.carbs) : null,
        protein: form.protein ? Number(form.protein) : null,
        fat: form.fat ? Number(form.fat) : null,
      },
      emphasize: form.emphasize,
      limit: form.limit,
      excludedFoods: form.excluded,
      notes: form.notes.trim(),
      responseTemplates: responseTemplates
        .filter((t) => t.message.trim())
        .map((t) => ({ ...t, name: t.name.trim() || "Untitled", keywords: t.keywords.filter(Boolean) })),
    };
  }

  function exportJson() {
    downloadFile(
      `${(codePrefix || "trewel-protocol").toLowerCase()}-protocol.json`,
      JSON.stringify({ study: name, protocol: buildProtocol() }, null, 2),
      "application/json"
    );
  }

  function create() {
    const id = createStudy({
      name: name.trim(),
      surface: researchMode ? "research" : "care",
      description: description.trim(),
      codePrefix: (codePrefix.trim() || name.trim().slice(0, 5)).toUpperCase().replace(/[^A-Z0-9]/g, "") || "TRW",
      protocol: buildProtocol(),
    });
    navigate(`/researcher/studies/${id}`);
  }

  function addResponseTemplate() {
    setResponseTemplates((ts) => [
      ...ts,
      { id: makeTemplateId(), name: "", status: "off_protocol", keywords: [], message: "" },
    ]);
  }
  function updateRt(id, patch) {
    setResponseTemplates((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  function removeRt(id) {
    setResponseTemplates((ts) => ts.filter((t) => t.id !== id));
  }

  const STEPS = [
    { n: 1, label: "Starting point" },
    { n: 2, label: "Details" },
    { n: 3, label: "Rules" },
  ];
  const canLeave1 = activeTemplate != null;
  const canLeave2 = name.trim().length > 0;
  const canCreate = form.dietName.trim() && form.summary.trim();

  const chosen = LIBRARY.find((t) => t.id === activeTemplate);

  return (
    <Layout narrow context={lingo.console} headerRight={<ResearcherNav />}
      tabs={practitionerTabs(lingo, pending)}>
      <h1>Create {researchMode ? "study" : "care plan"}</h1>

      {/* progress */}
      <div className="stepper" aria-label={`Step ${step} of 3`}>
        {STEPS.map((s, i) => (
          <div key={s.n} style={{ display: "contents" }}>
            <div className={`stepper-node${step === s.n ? " stepper-node--active" : ""}${step > s.n ? " stepper-node--done" : ""}`}>
              <span className="stepper-dot">{step > s.n ? "✓" : s.n}</span>
              <span className="stepper-label">{s.label}</span>
            </div>
            {i < STEPS.length - 1 ? <span className="stepper-bar" /> : null}
          </div>
        ))}
      </div>

      {/* STEP 1 — choose a starting point (template-first) */}
      {step === 1 ? (
        <div className="wizard-step">
          <div className="card">
            <div className="card-kicker">{researchMode ? "Start from a protocol" : "Start from a condition"}</div>
            <h2 style={{ marginBottom: 4 }}>{researchMode ? "Pick a protocol template" : "What are you managing?"}</h2>
            <p className="muted small" style={{ marginTop: 0 }}>
              Pick the closest match — every rule stays fully editable. This is the fastest way to a working plan.
            </p>
            <div className="template-cards">
              {LIBRARY.map((entry) => (
                <button key={entry.id} type="button"
                  className={`template-card${activeTemplate === entry.id ? " template-card--active" : ""}`}
                  onClick={() => applyLibraryTemplate(entry)}>
                  <div className="tc-name">{entry.name}</div>
                  <div className="tc-blurb">{entry.blurb}</div>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--rule)" }}>
              <button type="button"
                className={`template-card template-card--custom${activeTemplate === "blank" ? " template-card--active" : ""}`}
                style={{ display: "block", width: "100%" }}
                onClick={() => applyLibraryTemplate(null)}>
                <div className="tc-name">Build a custom plan from scratch</div>
                <div className="tc-blurb">Define every rule yourself — excluded foods, macro targets, food-group requirements.</div>
              </button>
            </div>
          </div>
          <div className="wizard-actions">
            <span />
            <button className="btn" disabled={!canLeave1} onClick={() => setStep(2)}>Continue →</button>
          </div>
        </div>
      ) : null}

      {/* STEP 2 — name & who it's for */}
      {step === 2 ? (
        <div className="wizard-step">
          <div className="card">
            <div className="card-kicker">{researchMode ? "Study details" : "Plan details"}</div>
            <div className="field">
              <label htmlFor="s-name">{researchMode ? "Study" : "Care plan"} name *</label>
              <input id="s-name" className="input" required value={name} autoFocus onChange={(e) => setName(e.target.value)}
                placeholder={researchMode ? "e.g. KETO-07 · Ketogenic Diet Adherence Pilot" : "e.g. J. Alvarez · Hypertension plan"} />
            </div>
            <div className="field">
              <label htmlFor="s-prefix">{lingo.client} code prefix *</label>
              <input id="s-prefix" className="input" required value={codePrefix} onChange={(e) => setCodePrefix(e.target.value)}
                placeholder={researchMode ? "e.g. KETO7" : "e.g. HTN"} maxLength={8}
                style={{ maxWidth: 220, fontFamily: "var(--font-mono)", textTransform: "uppercase" }} />
              <div className="hint">{lingo.client} codes look like HTN-4F7K — the code is their whole login; no {lingo.clientLower} name or email is stored.</div>
            </div>
            <div className="field mb-0">
              <label htmlFor="s-desc">Description (optional)</label>
              <textarea id="s-desc" className="textarea" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder={researchMode ? "Aims, arm, and duration — for your team's reference." : "Context for you — goals, visit cadence, anything worth remembering."} />
            </div>
          </div>
          <div className="wizard-actions">
            <button className="btn btn--secondary" onClick={() => setStep(1)}>← Back</button>
            <button className="btn" disabled={!canLeave2} onClick={() => setStep(3)}>Continue →</button>
          </div>
        </div>
      ) : null}

      {/* STEP 3 — the rules (pre-filled from the template) + deviation messages */}
      {step === 3 ? (
        <div className="wizard-step">
          {chosen ? (
            <div className="banner" style={{ marginBottom: 16 }}>
              <span>Pre-filled from <strong>{chosen.name}</strong>. Adjust anything below, or leave it as-is.</span>
            </div>
          ) : null}

          <div className="card">
            <div className="card-kicker">Plan rules</div>
            <p className="muted small" style={{ marginTop: 0 }}>
              Every meal photo is checked against exactly these rules, rule by rule.
            </p>
            <div className="field">
              <label htmlFor="p-diet">Protocol name *</label>
              <input id="p-diet" className="input" required value={form.dietName} onChange={setEv("dietName")}
                placeholder="e.g. Ketogenic diet (intervention arm)" />
            </div>
            <div className="field">
              <label htmlFor="p-summary">Plain-language summary *</label>
              <textarea id="p-summary" className="textarea" required value={form.summary} onChange={setEv("summary")}
                placeholder="Shown to your client exactly as written — describe the eating pattern in one or two sentences." />
            </div>

            <div className="field">
              <label htmlFor="p-excl">Explicitly excluded foods</label>
              <TagInput id="p-excl" value={form.excluded} onChange={set("excluded")} placeholder="e.g. Sugary drinks" />
              <div className="hint">A meal containing any of these is scored off-plan.</div>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="p-emph">Food groups to emphasize</label>
                <TagInput id="p-emph" value={form.emphasize} onChange={set("emphasize")} placeholder="e.g. Vegetables" />
              </div>
              <div className="field">
                <label htmlFor="p-limit">Food groups to limit</label>
                <TagInput id="p-limit" value={form.limit} onChange={set("limit")} placeholder="e.g. Refined grains" />
              </div>
            </div>

            {/* Advanced numeric targets tucked behind a disclosure to cut density */}
            <div className="note-disclosure" style={{ marginTop: 4 }}>
              <button type="button" className="note-toggle" aria-expanded={showAdvanced}
                onClick={() => setShowAdvanced((v) => !v)}>
                <span className="chev" aria-hidden="true">›</span> {showAdvanced ? "Hide" : "Add"} energy, sodium &amp; macro targets
              </button>
              {showAdvanced ? (
                <div style={{ marginTop: 12 }}>
                  <div className="field-row">
                    <div className="field">
                      <label htmlFor="p-calmin">Energy/meal — min (kcal)</label>
                      <input id="p-calmin" className="input" type="number" min="0" value={form.calMin} onChange={setEv("calMin")} placeholder="450" />
                    </div>
                    <div className="field">
                      <label htmlFor="p-calmax">Energy/meal — max (kcal)</label>
                      <input id="p-calmax" className="input" type="number" min="0" value={form.calMax} onChange={setEv("calMax")} placeholder="750" />
                    </div>
                    <div className="field">
                      <label htmlFor="p-sodium">Sodium/meal (mg)</label>
                      <input id="p-sodium" className="input" type="number" min="0" value={form.sodium} onChange={setEv("sodium")} placeholder="800" />
                    </div>
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label htmlFor="p-carbs">Carbohydrate (%)</label>
                      <input id="p-carbs" className="input" type="number" min="0" max="100" value={form.carbs} onChange={setEv("carbs")} placeholder="45" />
                    </div>
                    <div className="field">
                      <label htmlFor="p-protein">Protein (%)</label>
                      <input id="p-protein" className="input" type="number" min="0" max="100" value={form.protein} onChange={setEv("protein")} placeholder="20" />
                    </div>
                    <div className="field">
                      <label htmlFor="p-fat">Fat (%)</label>
                      <input id="p-fat" className="input" type="number" min="0" max="100" value={form.fat} onChange={setEv("fat")} placeholder="35" />
                    </div>
                  </div>
                  <div className="field mb-0">
                    <label htmlFor="p-notes">Additional notes for the matcher</label>
                    <textarea id="p-notes" className="textarea" value={form.notes} onChange={setEv("notes")}
                      placeholder="e.g. restaurant meals logged like any other meal." />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="card">
            <div className="card-title-row" style={{ marginBottom: 6 }}>
              <div>
                <div className="card-kicker">Deviation responses</div>
                <h2 style={{ fontSize: 17 }}>What your {lingo.clientsLower} read when a meal deviates</h2>
              </div>
              <button type="button" className="btn btn--secondary btn--small" onClick={addResponseTemplate}>+ Add message</button>
            </div>
            <p className="muted small" style={{ marginTop: 0 }}>
              You write these once; Trewel shows the matching one verbatim. The AI reports the
              rule-by-rule comparison — it never writes its own guidance to your {lingo.clientsLower}.
            </p>
            {responseTemplates.map((t) => (
              <div key={t.id} className="rt-row">
                <div className="rt-head">
                  <input className="input" style={{ flex: 1, minWidth: 160 }} value={t.name}
                    placeholder="Message name — e.g. High sodium"
                    aria-label="Message name"
                    onChange={(e) => updateRt(t.id, { name: e.target.value })} />
                  <select className="input" value={t.status} aria-label="Applies to match status"
                    onChange={(e) => updateRt(t.id, { status: e.target.value })}>
                    <option value="partial_deviation">On partial deviation</option>
                    <option value="off_protocol">On off-plan</option>
                  </select>
                  <button type="button" className="btn btn--ghost" onClick={() => removeRt(t.id)}
                    aria-label={`Remove message ${t.name || ""}`}>Remove</button>
                </div>
                <div className="field">
                  <label>Trigger keywords (optional, comma-separated)</label>
                  <input className="input" value={t.keywords.join(", ")}
                    placeholder="e.g. sodium, canned, cured — leave empty to use as the general message for this status"
                    onChange={(e) => updateRt(t.id, { keywords: e.target.value.split(",").map((k) => k.trim()) })} />
                </div>
                <div className="field mb-0">
                  <label>Message shown to the {lingo.clientLower} *</label>
                  <textarea className="textarea" value={t.message}
                    placeholder="Written in your voice, shown verbatim."
                    onChange={(e) => updateRt(t.id, { message: e.target.value })} />
                </div>
              </div>
            ))}
            {!responseTemplates.length ? (
              <div className="empty" style={{ padding: 20 }}>
                No messages yet — your {lingo.clientsLower} will see only the factual rule-by-rule comparison.
                Add one, or continue without.
              </div>
            ) : null}
          </div>

          <div className="wizard-actions">
            <button className="btn btn--secondary" onClick={() => setStep(2)}>← Back</button>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="btn btn--secondary" onClick={exportJson}>Export JSON</button>
              <button className="btn" disabled={!canCreate} onClick={create}>Create {researchMode ? "study" : "care plan"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </Layout>
  );
}

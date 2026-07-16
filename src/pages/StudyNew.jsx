import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Layout, ResearcherNav } from "../components/ui.jsx";
import { useStore } from "../lib/store.jsx";
import { PROTOCOL_LIBRARY, makeTemplateId } from "../lib/protocolTemplates.js";
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
  const { createStudy } = useStore();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [codePrefix, setCodePrefix] = useState("");
  const [description, setDescription] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [responseTemplates, setResponseTemplates] = useState([]);
  const [activeTemplate, setActiveTemplate] = useState("blank");

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

  function submit(e) {
    e.preventDefault();
    const id = createStudy({
      name: name.trim(),
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

  return (
    <Layout narrow context="Researcher console" headerRight={<ResearcherNav />}>
      <h1>Create study</h1>
      <p className="muted small">
        Define the diet protocol as structured rules — the AI meal-matcher scores every photo against
        exactly these rules — and pre-write the messages participants see when a meal deviates.
      </p>

      <form onSubmit={submit}>
        <div className="card">
          <div className="card-kicker">Start from a protocol template</div>
          <div className="template-picker">
            <button type="button"
              className={`template-chip${activeTemplate === "blank" ? " template-chip--active" : ""}`}
              onClick={() => applyLibraryTemplate(null)}>
              Blank protocol
            </button>
            {PROTOCOL_LIBRARY.map((entry) => (
              <button key={entry.id} type="button"
                className={`template-chip${activeTemplate === entry.id ? " template-chip--active" : ""}`}
                onClick={() => applyLibraryTemplate(entry)}>
                {entry.name}
              </button>
            ))}
          </div>
          <p className="template-blurb">
            {activeTemplate === "blank"
              ? "Build every rule yourself."
              : PROTOCOL_LIBRARY.find((t) => t.id === activeTemplate)?.blurb}
            {" "}Every field stays editable after you pick.
          </p>
        </div>

        <div className="card">
          <div className="card-kicker">Study</div>
          <div className="field">
            <label htmlFor="s-name">Study name *</label>
            <input id="s-name" className="input" required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. KETO-07 · Ketogenic Diet Adherence Pilot" />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="s-prefix">Participant code prefix *</label>
              <input id="s-prefix" className="input" required value={codePrefix} onChange={(e) => setCodePrefix(e.target.value)}
                placeholder="e.g. KETO7" maxLength={8} />
              <div className="hint">Participant IDs look like KETO7-4F7K — no names or emails are collected.</div>
            </div>
          </div>
          <div className="field mb-0">
            <label htmlFor="s-desc">Description</label>
            <textarea id="s-desc" className="textarea" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Aims, arm, and duration — for your team's reference." />
          </div>
        </div>

        <div className="card">
          <div className="card-kicker">Diet protocol</div>
          <div className="field">
            <label htmlFor="p-diet">Protocol name *</label>
            <input id="p-diet" className="input" required value={form.dietName} onChange={setEv("dietName")}
              placeholder="e.g. Ketogenic diet (intervention arm)" />
          </div>
          <div className="field">
            <label htmlFor="p-summary">Plain-language summary *</label>
            <textarea id="p-summary" className="textarea" required value={form.summary} onChange={setEv("summary")}
              placeholder="Shown to participants exactly as written — describe the eating pattern in one or two sentences." />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="p-calmin">Energy per meal — min (kcal)</label>
              <input id="p-calmin" className="input" type="number" min="0" value={form.calMin} onChange={setEv("calMin")} placeholder="450" />
            </div>
            <div className="field">
              <label htmlFor="p-calmax">Energy per meal — max (kcal)</label>
              <input id="p-calmax" className="input" type="number" min="0" value={form.calMax} onChange={setEv("calMax")} placeholder="750" />
            </div>
            <div className="field">
              <label htmlFor="p-sodium">Sodium limit per meal (mg)</label>
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
          <p className="hint" style={{ marginTop: -8, marginBottom: 16 }}>
            Macro targets are approximate — photo analysis estimates composition, it cannot weigh food.
          </p>

          <div className="field">
            <label htmlFor="p-emph">Food groups to emphasize</label>
            <TagInput id="p-emph" value={form.emphasize} onChange={set("emphasize")} placeholder="Type a food group and press Enter — e.g. Vegetables" />
          </div>
          <div className="field">
            <label htmlFor="p-limit">Food groups to limit</label>
            <TagInput id="p-limit" value={form.limit} onChange={set("limit")} placeholder="e.g. Refined grains" />
          </div>
          <div className="field">
            <label htmlFor="p-excl">Explicitly excluded foods</label>
            <TagInput id="p-excl" value={form.excluded} onChange={set("excluded")} placeholder="e.g. Sugary drinks" />
            <div className="hint">A meal containing any of these is scored off-protocol.</div>
          </div>
          <div className="field mb-0">
            <label htmlFor="p-notes">Additional protocol notes</label>
            <textarea id="p-notes" className="textarea" value={form.notes} onChange={setEv("notes")}
              placeholder="Anything else the matcher should consider — e.g. restaurant meals logged like any other meal." />
          </div>
        </div>

        <div className="card">
          <div className="card-title-row" style={{ marginBottom: 6 }}>
            <div>
              <div className="card-kicker">Deviation responses</div>
              <h2 style={{ fontSize: 17 }}>What participants read when a meal deviates</h2>
            </div>
            <button type="button" className="btn btn--secondary btn--small" onClick={addResponseTemplate}>+ Add template</button>
          </div>
          <p className="muted small" style={{ marginTop: 0 }}>
            You write these once; Trewel shows the matching one verbatim. The AI reports the protocol
            comparison — it never writes its own guidance to participants.
          </p>
          {responseTemplates.map((t) => (
            <div key={t.id} className="rt-row">
              <div className="rt-head">
                <input className="input" style={{ flex: 1, minWidth: 160 }} value={t.name}
                  placeholder="Template name — e.g. High sodium"
                  aria-label="Template name"
                  onChange={(e) => updateRt(t.id, { name: e.target.value })} />
                <select className="input" value={t.status} aria-label="Applies to match status"
                  onChange={(e) => updateRt(t.id, { status: e.target.value })}>
                  <option value="partial_deviation">On partial deviation</option>
                  <option value="off_protocol">On off-protocol</option>
                </select>
                <button type="button" className="btn btn--ghost" onClick={() => removeRt(t.id)}
                  aria-label={`Remove template ${t.name || ""}`}>Remove</button>
              </div>
              <div className="field">
                <label>Trigger keywords (optional, comma-separated)</label>
                <input className="input" value={t.keywords.join(", ")}
                  placeholder="e.g. sodium, canned, cured — leave empty to use as the general message for this status"
                  onChange={(e) => updateRt(t.id, { keywords: e.target.value.split(",").map((k) => k.trim()) })} />
              </div>
              <div className="field mb-0">
                <label>Message shown to the participant *</label>
                <textarea className="textarea" value={t.message}
                  placeholder="Written in your voice, shown verbatim."
                  onChange={(e) => updateRt(t.id, { message: e.target.value })} />
              </div>
            </div>
          ))}
          {!responseTemplates.length ? (
            <div className="empty" style={{ padding: 20 }}>
              No templates yet — participants will see only the factual protocol comparison.
              Pick a protocol template above or add your own message.
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" className="btn btn--secondary" onClick={exportJson}>Export protocol (JSON)</button>
          <button type="submit" className="btn">Create study</button>
        </div>
      </form>
    </Layout>
  );
}

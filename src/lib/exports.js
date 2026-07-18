// Export builders: REDCap-compatible CSV (the standard data tool in academic
// research), a matching REDCap data dictionary, and a one-page data-handling
// summary a researcher can hand to their IRB or compliance office.

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\r\n") + "\r\n";
}

export function downloadFile(name, content, mime = "text/plain") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function isoLocal(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ------------------------------------------------------------------ */
/* REDCap data export — repeating "meal_log" instrument, keyed by the  */
/* participant code as record_id.                                      */
/* ------------------------------------------------------------------ */
export function buildRedcapCsv(study, participants) {
  const rows = [[
    "record_id",
    "redcap_repeat_instrument",
    "redcap_repeat_instance",
    "study_code",
    "meal_datetime",
    "identified_items",
    "match_status",
    "confidence",
    "adherence_score",
    "review_state",
    "reviewed_by",
    "ai_reason",
    "participant_note",
    "analysis_engine",
  ]];
  for (const code of study.participants) {
    const p = participants[code];
    if (!p) continue;
    const meals = [...p.meals].sort((a, b) => a.timestamp - b.timestamp);
    meals.forEach((m, i) => {
      rows.push([
        code,
        "meal_log",
        i + 1,
        study.codePrefix || "",
        isoLocal(m.timestamp),
        (m.result.identified_items || []).map((it) => `${it.name} (${it.estimated_portion})`).join("; "),
        m.result.match_status,
        m.result.confidence || "",
        m.review?.state === "pending" ? "" : m.result.score, // pending meals carry no score
        m.review?.state || "auto_confirmed",
        m.review?.by || "",
        m.result.reason,
        m.note || "",
        m.engine || "",
      ]);
    });
  }
  return toCsv(rows);
}

// REDCap data dictionary describing the meal_log instrument.
export function buildRedcapDictionary() {
  const H = [
    "Variable / Field Name", "Form Name", "Section Header", "Field Type",
    "Field Label", "Choices, Calculations, OR Slider Labels", "Field Note",
    "Text Validation Type OR Show Slider Number", "Text Validation Min",
    "Text Validation Max", "Identifier?", "Branching Logic (Show field only if...)",
    "Required Field?", "Custom Alignment", "Question Number (surveys only)",
    "Matrix Group Name", "Matrix Ranking?", "Field Annotation",
  ];
  const f = (name, type, label, choices = "", note = "", validation = "") =>
    [name, "meal_log", "", type, label, choices, note, validation, "", "", "", "", "", "", "", "", "", ""];
  const rows = [
    H,
    f("record_id", "text", "Participant code", "", "Anonymous study code; no PII."),
    f("study_code", "text", "Study code prefix"),
    f("meal_datetime", "text", "Meal date/time", "", "Local time of logging.", "datetime_ymd"),
    f("identified_items", "notes", "Identified food items", "", "AI-identified items with rough portion estimates."),
    f("match_status", "radio", "Protocol match status", "on_protocol, On protocol | partial_deviation, Partial deviation | off_protocol, Off protocol"),
    f("confidence", "radio", "AI confidence", "high, High | medium, Medium | low, Low", "Low-confidence matches are routed to human review."),
    f("adherence_score", "text", "Meal adherence score (0-100)", "", "Blank while the match is pending human review.", "integer"),
    f("review_state", "radio", "Review state", "auto_confirmed, Auto-verified | pending, Pending review | confirmed, Reviewer confirmed | corrected, Reviewer corrected"),
    f("reviewed_by", "text", "Reviewer"),
    f("ai_reason", "notes", "AI protocol-match explanation"),
    f("participant_note", "notes", "Participant note"),
    f("analysis_engine", "text", "Analysis engine", "", "gemini = live multimodal AI; simulated/seeded = demo analyzer."),
  ];
  return toCsv(rows);
}

/* ------------------------------------------------------------------ */
/* One-page data-handling summary (markdown) for an IRB / compliance   */
/* office.                                                             */
/* ------------------------------------------------------------------ */
export function buildDataHandlingSummary(data) {
  const studies = Object.values(data.studies);
  const participantCount = Object.keys(data.participants).length;
  const retention = data.settings?.retentionDays ?? 90;
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  return `# Trewel — Data Handling Summary
Prepared ${today} · Generated from the Trewel researcher console

## What Trewel is
Trewel is a research support and data-collection tool for free-living nutrition
trials. Participants photograph meals; an AI matcher compares each photo against
the researcher-defined diet protocol and records an adherence score. Trewel does
not diagnose, treat, or provide dietary advice, and it is not a medical device.

## Active studies in this workspace
${studies.map((s) => `- ${s.name} — ${s.participants.length} participants`).join("\n")}
- Total enrolled participant codes: ${participantCount}

## Data collected
| Element | Collected | Notes |
|---|---|---|
| Meal photographs | Yes | Participants are instructed to photograph the plate only |
| Logging timestamps | Yes | Local device time |
| AI match results | Yes | Status, confidence, score, plain-language reason |
| Participant notes | Optional | Free text, participant-authored |
| Names / emails / phone | No | Participants are identified by anonymous study codes only |
| Location data | No | Not collected |

## Identifiers
Participants are enrolled under randomly generated study codes (e.g. MED24-4F7K).
No name, email address, or other direct identifier is collected or stored.

## AI processing
Meal photos are transmitted to a multimodal AI model solely to compare the meal
against the practitioner-defined plan, rule by rule. Low-confidence matches are
not scored automatically; they are routed to a human review queue and count
toward adherence only after confirmation or correction. All client-facing
feedback about deviations is practitioner-pre-authored template text — the AI
never generates novel dietary guidance.

## Storage & retention (prototype configuration)
- Storage: browser localStorage on the researcher's/participant's own device
  (prototype only; production deployment would use institution-approved storage
  under a data-use agreement).
- Retention setting: study data retained ${retention} days after study close,
  then deleted.
- Manual deletion: workspace data can be deleted immediately from the
  Data handling panel.

## Access & audit
Practitioner access requires an authenticated account (email + hashed
password); client access requires only their invite code.
The workspace keeps an audit log of study creation, enrollment, review
decisions, settings changes, and data exports (${(data.audit || []).length} entries to date),
inspectable in the Data handling panel.

## Export formats
Study data exports as REDCap-compatible CSV (with data dictionary) and the
protocol as JSON, for institutional data management.

---
*Prototype notice: this summary describes the demonstration build. Production
deployment requires the agreements appropriate to the setting — HIPAA
business-associate agreements for clinical practice, or IRB approval and
institutional data-use agreements for research — covering photo capture,
storage, and retention.*
`;
}

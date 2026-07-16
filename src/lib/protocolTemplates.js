// Pre-built protocol templates a researcher can start a study from, plus the
// matcher that picks a researcher-authored response template for a scored
// meal. Trewel never generates novel dietary guidance: every message shown to
// a participant is written (or explicitly accepted) by the researcher here.

let templateSeq = 0;
export function makeTemplateId() {
  return `tpl_${Date.now().toString(36)}_${templateSeq++}`;
}

// Response template shape:
// { id, name, status: "partial_deviation"|"off_protocol", keywords: [], message }
// keywords are matched (case-insensitive) against the AI's reason + item names;
// a keyword template wins over the status's general (keyword-less) template.
export function findResponseTemplate(protocol, result) {
  const templates = protocol?.responseTemplates || [];
  if (!result || result.match_status === "on_protocol") return null;
  const haystack = [
    result.reason || "",
    ...(result.identified_items || []).map((it) => it.name),
  ].join(" ").toLowerCase();
  const candidates = templates.filter((t) => t.status === result.match_status && t.message?.trim());
  const keyed = candidates.find(
    (t) => t.keywords?.length && t.keywords.some((k) => k && haystack.includes(k.toLowerCase()))
  );
  return keyed || candidates.find((t) => !t.keywords?.length) || null;
}

/* ------------------------------------------------------------------ */
/* Protocol library                                                    */
/* ------------------------------------------------------------------ */

export const PROTOCOL_LIBRARY = [
  {
    id: "mediterranean",
    name: "Mediterranean-style",
    blurb: "Vegetables, legumes, whole grains, fish, olive oil; red meat and processed foods limited.",
    codePrefix: "MED",
    protocol: {
      dietName: "Mediterranean diet (intervention arm)",
      summary:
        "Meals built around vegetables, fruits, legumes, whole grains, fish, and olive oil. Red meat and refined grains limited; processed foods and sugary drinks excluded.",
      caloriesPerMealMin: 450,
      caloriesPerMealMax: 750,
      sodiumLimitMg: 800,
      macros: { carbs: 45, protein: 20, fat: 35 },
      emphasize: ["Vegetables", "Fruits", "Legumes", "Whole grains", "Fish & seafood", "Olive oil", "Nuts"],
      limit: ["Red meat", "Refined grains", "Butter", "Full-fat dairy"],
      excludedFoods: ["Sugary drinks", "Processed snack foods", "Fast food", "Processed meat"],
      notes: "Participants log all main meals; snacks optional.",
      responseTemplates: [
        {
          id: "med-partial",
          name: "General partial deviation",
          status: "partial_deviation",
          keywords: [],
          message:
            "Mostly on plan — one item fell outside your protocol. Keep red meat and refined grains occasional and small, and you're on track.",
        },
        {
          id: "med-off-processed",
          name: "Processed / fast food",
          status: "off_protocol",
          keywords: ["fast food", "processed", "pizza", "burger", "fries", "soft drink", "sugary"],
          message:
            "This meal included foods excluded in your study plan. Nothing to fix retroactively — just build your next meals around vegetables, whole grains, fish, or legumes.",
        },
        {
          id: "med-off-general",
          name: "General off-protocol",
          status: "off_protocol",
          keywords: [],
          message:
            "This meal didn't match your assigned plan. That happens — please keep logging every meal so your study record stays complete.",
        },
      ],
    },
  },
  {
    id: "dash",
    name: "DASH",
    blurb: "Fruits, vegetables, whole grains, low-fat dairy; sodium moderated.",
    codePrefix: "DASH",
    protocol: {
      dietName: "DASH eating pattern",
      summary:
        "Fruits, vegetables, whole grains, and low-fat dairy at every meal, with lean poultry and fish. Sodium moderated; sweets and sugary drinks limited.",
      caloriesPerMealMin: 400,
      caloriesPerMealMax: 700,
      sodiumLimitMg: 750,
      macros: { carbs: 55, protein: 18, fat: 27 },
      emphasize: ["Vegetables", "Fruits", "Whole grains", "Low-fat dairy", "Poultry & fish", "Nuts & legumes"],
      limit: ["Added salt", "Red meat", "Sweets", "Sugary drinks"],
      excludedFoods: ["Fast food", "Salted snacks"],
      notes: "Restaurant meals are logged like any other meal.",
      responseTemplates: [
        {
          id: "dash-sodium",
          name: "High sodium",
          status: "partial_deviation",
          keywords: ["sodium", "salt", "canned", "cured", "deli", "instant", "pickle", "sauced"],
          message:
            "This meal looks higher in sodium than your target. Fresh or frozen (unsalted) versions of the same foods usually fit the plan well.",
        },
        {
          id: "dash-off",
          name: "General off-protocol",
          status: "off_protocol",
          keywords: [],
          message:
            "This meal fell outside your assigned plan. Please keep logging everything — complete records matter more to the study than perfect days.",
        },
      ],
    },
  },
  {
    id: "low-sodium",
    name: "Low-sodium (strict)",
    blurb: "Hard per-meal sodium ceiling; cured meats, canned soups, instant foods excluded.",
    codePrefix: "LS",
    protocol: {
      dietName: "Sodium-restricted",
      summary:
        "Fresh, unprocessed foods with a hard sodium ceiling per meal. Cured meats, canned soups, instant noodles, and fast food are excluded; no added salt at the table.",
      caloriesPerMealMin: 400,
      caloriesPerMealMax: 700,
      sodiumLimitMg: 600,
      macros: { carbs: 55, protein: 18, fat: 27 },
      emphasize: ["Vegetables", "Fruits", "Whole grains", "Low-fat dairy", "Poultry & fish"],
      limit: ["Added salt", "Bread & baked goods", "Cheese"],
      excludedFoods: ["Cured meats", "Canned soup", "Instant noodles", "Fast food", "Salted snacks"],
      notes: "Participants are asked not to add salt at the table.",
      responseTemplates: [
        {
          id: "ls-sodium",
          name: "High-sodium item",
          status: "partial_deviation",
          keywords: ["sodium", "salt", "canned", "cured", "deli", "instant", "pickle"],
          message:
            "One item in this meal is typically high in sodium. Rinsing canned items or choosing the low-sodium version usually brings the same meal within your target.",
        },
        {
          id: "ls-off",
          name: "Excluded high-sodium food",
          status: "off_protocol",
          keywords: [],
          message:
            "This meal included an item excluded under your sodium-restricted plan. Please keep logging every meal — the study needs the complete picture, not a perfect one.",
        },
      ],
    },
  },
  {
    id: "tre",
    name: "Time-restricted eating",
    blurb: "All meals inside a fixed daily eating window; food choices otherwise unrestricted.",
    codePrefix: "TRE",
    protocol: {
      dietName: "Time-restricted eating (10:00–18:00 window)",
      summary:
        "All meals and caloric drinks fall within a 10:00–18:00 eating window. Food choices are otherwise unrestricted; water, black coffee, and plain tea are fine any time.",
      caloriesPerMealMin: null,
      caloriesPerMealMax: null,
      sodiumLimitMg: null,
      macros: { carbs: null, protein: null, fat: null },
      emphasize: [],
      limit: [],
      excludedFoods: ["Meals outside the 10:00–18:00 window", "Caloric drinks outside the window"],
      notes:
        "Log the time you actually ate, not the time you photograph. The matcher compares the logged time against the eating window.",
      responseTemplates: [
        {
          id: "tre-window",
          name: "Outside eating window",
          status: "off_protocol",
          keywords: ["window", "outside", "time"],
          message:
            "This meal was logged outside your eating window. If the timing was unavoidable, add a note — accurate records help the study more than skipped logs.",
        },
        {
          id: "tre-partial",
          name: "General partial deviation",
          status: "partial_deviation",
          keywords: [],
          message:
            "Part of this meal may sit outside your window. Log it as it happened and carry on — your next window starts fresh tomorrow.",
        },
      ],
    },
  },
];

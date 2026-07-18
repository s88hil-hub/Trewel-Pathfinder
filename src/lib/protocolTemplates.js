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

/* ------------------------------------------------------------------ */
/* Condition-framed library — the default picker for dietitians.       */
/* Same rule engine (excluded foods, limits, macros, sodium) as the    */
/* research library above; organized the way practitioners think:      */
/* by the condition in front of them.                                  */
/* ------------------------------------------------------------------ */

export const CONDITION_LIBRARY = [
  {
    id: "t2d",
    name: "Type 2 diabetes",
    blurb: "Carb-consistent meals: non-starchy vegetables, lean protein, portioned whole grains; added sugar out.",
    codePrefix: "T2D",
    protocol: {
      dietName: "Type 2 diabetes — carb-consistent plan",
      summary:
        "Build each meal around non-starchy vegetables and lean protein, with a consistent, portioned serving of whole grains or starchy vegetables. Sugary drinks, desserts, and fruit juice are off-plan.",
      caloriesPerMealMin: 400,
      caloriesPerMealMax: 700,
      sodiumLimitMg: null,
      macros: { carbs: 40, protein: 25, fat: 35 },
      emphasize: ["Non-starchy vegetables", "Lean protein", "Whole grains (portioned)", "Legumes", "Nuts & seeds"],
      limit: ["Refined grains", "White rice & white bread", "Starchy sides beyond one portion", "Dried fruit"],
      excludedFoods: ["Sugary drinks", "Desserts & candy", "Fruit juice", "Sweetened cereals"],
      notes: "Consistency matters more than perfection — roughly the same carbohydrate portion at each meal.",
      responseTemplates: [
        {
          id: "t2d-sugar",
          name: "Added sugar / sweets",
          status: "off_protocol",
          keywords: ["sugar", "dessert", "candy", "juice", "soda", "sweetened", "soft drink"],
          message:
            "This meal included a sugary item that's off-plan. One meal doesn't undo your progress — just aim to pair your next meals with protein and vegetables, and keep logging.",
        },
        {
          id: "t2d-partial",
          name: "General partial deviation",
          status: "partial_deviation",
          keywords: [],
          message:
            "Close to plan — one item ran past your carbohydrate portion. Keeping starches to about a quarter of the plate usually brings the same meal back on plan.",
        },
        {
          id: "t2d-off",
          name: "General off-plan",
          status: "off_protocol",
          keywords: [],
          message:
            "This meal didn't match your plan. That happens — please keep logging every meal, since the full picture is what lets us adjust the plan together.",
        },
      ],
    },
  },
  {
    id: "pcos",
    name: "PCOS",
    blurb: "Lower-glycemic pattern: vegetables, protein, healthy fats; refined carbs and added sugar limited.",
    codePrefix: "PCOS",
    protocol: {
      dietName: "PCOS — lower-glycemic plan",
      summary:
        "Meals centered on vegetables, protein, and healthy fats, with slower carbohydrates in modest portions. Refined carbs and added sugars are kept to a minimum.",
      caloriesPerMealMin: 400,
      caloriesPerMealMax: 700,
      sodiumLimitMg: null,
      macros: { carbs: 35, protein: 30, fat: 35 },
      emphasize: ["Vegetables", "Lean protein", "Eggs", "Legumes", "Nuts & seeds", "Olive oil", "Whole grains (small portions)"],
      limit: ["Refined grains", "White bread & pastries", "Dried fruit", "Honey & syrups"],
      excludedFoods: ["Sugary drinks", "Desserts & candy", "Sweetened breakfast cereals"],
      notes: "Pairing carbohydrates with protein or fat blunts the glucose response — the plan is built around that.",
      responseTemplates: [
        {
          id: "pcos-refined",
          name: "Refined carbs",
          status: "partial_deviation",
          keywords: ["white bread", "pastry", "refined", "white rice", "bagel", "toast"],
          message:
            "This meal leaned on refined carbs. Swapping to the whole-grain version, or adding a protein alongside, usually keeps the same meal on plan.",
        },
        {
          id: "pcos-off",
          name: "General off-plan",
          status: "off_protocol",
          keywords: [],
          message:
            "This one fell outside your plan — no need to compensate, just carry on logging. Patterns over weeks are what we work with, not single meals.",
        },
      ],
    },
  },
  {
    id: "htn",
    name: "Hypertension (DASH)",
    blurb: "DASH pattern: fruits, vegetables, whole grains, low-fat dairy; sodium moderated.",
    codePrefix: "HTN",
    protocol: {
      dietName: "Hypertension — DASH eating pattern",
      summary:
        "Fruits, vegetables, whole grains, and low-fat dairy at every meal, with lean poultry and fish. Sodium moderated; salty processed foods and fast food are off-plan.",
      caloriesPerMealMin: 400,
      caloriesPerMealMax: 700,
      sodiumLimitMg: 750,
      macros: { carbs: 55, protein: 18, fat: 27 },
      emphasize: ["Vegetables", "Fruits", "Whole grains", "Low-fat dairy", "Poultry & fish", "Nuts & legumes"],
      limit: ["Added salt", "Red meat", "Sweets", "Sugary drinks"],
      excludedFoods: ["Fast food", "Salted snacks", "Cured meats"],
      notes: "Restaurant meals are logged like any other meal — the sodium check accounts for typical preparation.",
      responseTemplates: [
        {
          id: "htn-sodium",
          name: "High sodium",
          status: "partial_deviation",
          keywords: ["sodium", "salt", "canned", "cured", "deli", "instant", "pickle", "sauced"],
          message:
            "This meal looks higher in sodium than your target. Fresh or frozen (unsalted) versions of the same foods usually fit the plan well.",
        },
        {
          id: "htn-off",
          name: "General off-plan",
          status: "off_protocol",
          keywords: [],
          message:
            "This meal fell outside your plan. Please keep logging everything — a complete record matters more than a perfect one.",
        },
      ],
    },
  },
  {
    id: "renal",
    name: "Renal / low-sodium",
    blurb: "Strict sodium ceiling with potassium and phosphorus awareness; cured and canned items out.",
    codePrefix: "RNL",
    protocol: {
      dietName: "Renal — sodium-restricted plan",
      summary:
        "Fresh, unprocessed foods with a hard sodium ceiling per meal and attention to high-potassium and high-phosphorus items. Cured meats, canned soups, instant foods, and processed cheese are off-plan; no added salt at the table.",
      caloriesPerMealMin: 400,
      caloriesPerMealMax: 700,
      sodiumLimitMg: 600,
      macros: { carbs: 55, protein: 15, fat: 30 },
      emphasize: ["Fresh vegetables (lower-potassium)", "Fruits like apples & berries", "White rice & pasta", "Egg whites", "Poultry & fish (fresh)"],
      limit: ["Bananas & oranges", "Potatoes & tomatoes", "Dairy", "Whole-grain breads", "Cola"],
      excludedFoods: ["Cured meats", "Canned soup", "Instant noodles", "Processed cheese", "Salted snacks", "Fast food"],
      notes: "Portions matter for the limited list — small amounts may fit; the plan flags visibly large servings.",
      responseTemplates: [
        {
          id: "renal-sodium",
          name: "High-sodium item",
          status: "partial_deviation",
          keywords: ["sodium", "salt", "canned", "cured", "deli", "instant", "cheese"],
          message:
            "One item here is typically high in sodium. Rinsing canned items or choosing the no-salt-added version usually brings the same meal within your target.",
        },
        {
          id: "renal-off",
          name: "Excluded item",
          status: "off_protocol",
          keywords: [],
          message:
            "This meal included an item excluded under your renal plan. Please keep logging every meal — we adjust the plan from the complete picture, never from guilt.",
        },
      ],
    },
  },
  {
    id: "gerd",
    name: "GERD",
    blurb: "Reflux-trigger avoidance: fried, citrus, tomato-heavy, chocolate, mint, and carbonated items out.",
    codePrefix: "GERD",
    protocol: {
      dietName: "GERD — reflux-trigger avoidance plan",
      summary:
        "Meals built from lean proteins, oats and rice, non-citrus fruits, and vegetables. Common reflux triggers — fried food, citrus, tomato-heavy dishes, chocolate, mint, coffee, and carbonated drinks — are off-plan.",
      caloriesPerMealMin: 350,
      caloriesPerMealMax: 650,
      sodiumLimitMg: null,
      macros: { carbs: 50, protein: 25, fat: 25 },
      emphasize: ["Lean proteins", "Oats & rice", "Non-citrus fruits (banana, melon)", "Green vegetables", "Ginger"],
      limit: ["High-fat meals", "Spicy dishes", "Onion & garlic-heavy dishes", "Late-evening large meals"],
      excludedFoods: ["Fried foods", "Citrus fruits & juice", "Tomato-heavy dishes", "Chocolate", "Mint", "Coffee", "Carbonated drinks", "Alcohol"],
      notes: "Meal size matters as much as ingredients — visibly oversized meals are flagged as partial deviations.",
      responseTemplates: [
        {
          id: "gerd-trigger",
          name: "Trigger food",
          status: "off_protocol",
          keywords: ["fried", "citrus", "tomato", "chocolate", "mint", "coffee", "carbonated", "soda"],
          message:
            "This meal included one of your identified trigger foods. If symptoms follow, add a note to the log — matching triggers to symptoms is exactly what this plan is for.",
        },
        {
          id: "gerd-partial",
          name: "General partial deviation",
          status: "partial_deviation",
          keywords: [],
          message:
            "Mostly on plan — one element (portion size or a borderline trigger) fell outside it. Smaller, earlier meals tend to sit best; keep logging how you feel.",
        },
      ],
    },
  },
  {
    id: "fodmap",
    name: "IBS / low-FODMAP",
    blurb: "Elimination-phase FODMAP avoidance: onion, garlic, wheat, legumes, and high-FODMAP fruits out.",
    codePrefix: "IBS",
    protocol: {
      dietName: "IBS — low-FODMAP elimination phase",
      summary:
        "Elimination-phase meals from low-FODMAP foods: rice, oats, firm bananas, carrots, potatoes, lean proteins, and lactose-free dairy. Onion, garlic, wheat-heavy items, legumes, apples, and honey are off-plan for now.",
      caloriesPerMealMin: 350,
      caloriesPerMealMax: 700,
      sodiumLimitMg: null,
      macros: { carbs: 50, protein: 22, fat: 28 },
      emphasize: ["Rice & oats", "Firm bananas", "Carrots & zucchini", "Potatoes", "Lean proteins", "Lactose-free dairy", "Sourdough (spelt)"],
      limit: ["Sweet corn", "Avocado (small amounts ok)", "Processed sauces"],
      excludedFoods: ["Onion", "Garlic", "Wheat bread & pasta", "Beans & lentils", "Apples & pears", "Honey", "High-fructose sweeteners", "Regular milk"],
      notes: "This is a temporary elimination phase — foods get reintroduced deliberately, one at a time, with your dietitian.",
      responseTemplates: [
        {
          id: "fodmap-hidden",
          name: "Hidden FODMAP (onion/garlic)",
          status: "off_protocol",
          keywords: ["onion", "garlic", "sauce", "dressing", "marinade"],
          message:
            "This meal likely contained onion or garlic — the most common hidden FODMAPs, especially in sauces. If symptoms follow, note them; garlic-infused oil is usually a safe swap.",
        },
        {
          id: "fodmap-partial",
          name: "General partial deviation",
          status: "partial_deviation",
          keywords: [],
          message:
            "One item here may be moderate-FODMAP. During elimination we keep things strict so reintroduction results are clean — note any symptoms and carry on.",
        },
      ],
    },
  },
  {
    id: "weight",
    name: "Weight management",
    blurb: "Portion-focused: vegetables and protein forward, energy range per meal, sugary drinks out.",
    codePrefix: "WM",
    protocol: {
      dietName: "Weight management — portion-focused plan",
      summary:
        "Meals in a consistent energy range, built vegetables-and-protein-first. Refined grains and fried foods kept occasional; sugary drinks are off-plan.",
      caloriesPerMealMin: 400,
      caloriesPerMealMax: 600,
      sodiumLimitMg: null,
      macros: { carbs: 40, protein: 30, fat: 30 },
      emphasize: ["Vegetables (half the plate)", "Lean protein", "Whole grains", "Fruit", "Water or unsweetened drinks"],
      limit: ["Refined grains", "Fried foods", "Desserts", "Alcohol"],
      excludedFoods: ["Sugary drinks", "Sweetened coffee drinks"],
      notes: "The plan checks portions and pattern, not willpower. Log everything — including the off-plan meals.",
      responseTemplates: [
        {
          id: "wm-portion",
          name: "Portion size",
          status: "partial_deviation",
          keywords: ["large", "portion", "serving", "oversized"],
          message:
            "The foods fit your plan — the portion looks larger than your target range. Same meal, a bit smaller, is fully on plan.",
        },
        {
          id: "wm-off",
          name: "General off-plan",
          status: "off_protocol",
          keywords: [],
          message:
            "This meal fell outside your plan. One meal is one data point — the streak that matters is logging, not perfection. Keep going.",
        },
      ],
    },
  },
];

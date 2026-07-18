// ---------------------------------------------------------------------------
// Trewel AI matching module
//
// This is the single place where meal photos are compared against a study
// protocol. It is deliberately isolated from the UI so it can be swapped for
// a production backend later.
//
//   analyzeMeal({ imageBase64, mediaType, note, protocol })
//     -> { engine: "gemini" | "simulated", result: { ...structured match } }
//
// When GEMINI_API_KEY is available, the analysis is performed by a
// multimodal Gemini call (Google AI Studio's free tier — no billing
// required) with a strict JSON schema on the output. When no credential is
// available — or the API call fails — a deterministic simulated analyzer
// keeps the demo functional, and the response is labeled accordingly so the
// UI can disclose it.
// ---------------------------------------------------------------------------

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const GEMINI_MODEL = "gemini-flash-latest";

// Structured-output schema: what the model must return for every photo.
// (Gemini's schema format is a constrained subset of OpenAPI/JSON Schema —
// no additionalProperties, and types come from the SchemaType enum.)
const RESULT_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    is_food_photo: {
      type: SchemaType.BOOLEAN,
      description: "True if the image clearly shows a meal or food items.",
    },
    privacy_flag: {
      type: SchemaType.BOOLEAN,
      description:
        "True if the image appears to include people, faces, or identifiable surroundings beyond the plate.",
    },
    identified_items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          estimated_portion: {
            type: SchemaType.STRING,
            description: "Rough portion estimate, e.g. '~1 cup' or '1 fillet (~150 g)'.",
          },
        },
        required: ["name", "estimated_portion"],
      },
    },
    rule_checks: {
      type: SchemaType.ARRAY,
      description:
        "One entry per explicit protocol rule, in this order when present: energy range, sodium limit, excluded foods, limited food groups, emphasized food groups.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          rule: {
            type: SchemaType.STRING,
            description: "Short rule name, e.g. 'Sodium limit' or 'Excluded foods'.",
          },
          result: { type: SchemaType.STRING, enum: ["pass", "fail", "unclear"] },
          detail: {
            type: SchemaType.STRING,
            description: "Very short factual outcome, e.g. 'within range' or 'processed meat detected'.",
          },
        },
        required: ["rule", "result", "detail"],
      },
    },
    match_status: {
      type: SchemaType.STRING,
      enum: ["on_protocol", "partial_deviation", "off_protocol"],
    },
    confidence: {
      type: SchemaType.STRING,
      enum: ["high", "medium", "low"],
      description:
        "How certain the match is. high = items and protocol comparison are clear. medium = some items or portions uncertain but the judgment is solid. low = photo unclear, items ambiguous, or the comparison hinges on details not visible.",
    },
    score: {
      type: SchemaType.INTEGER,
      description:
        "Adherence score contribution 0-100. on_protocol: 85-100, partial_deviation: 50-84, off_protocol: 0-49.",
    },
    reason: {
      type: SchemaType.STRING,
      description:
        "One or two plain-language sentences explaining the match result against the protocol rules. Neutral, factual tone. No advice.",
    },
  },
  required: [
    "is_food_photo",
    "privacy_flag",
    "identified_items",
    "rule_checks",
    "match_status",
    "confidence",
    "score",
    "reason",
  ],
};

function buildSystemPrompt() {
  return [
    "You are the automated meal-matching component of Trewel, a research data-collection tool used in nutrition studies.",
    "Your only job: identify the food items visible in a participant's meal photo, estimate rough portions, and compare the meal against the study protocol the researcher defined.",
    "You are NOT a medical or dietary advisor. Never give advice, recommendations, warnings about health, or suggestions for what to eat. Only describe what is visible and whether it matches the protocol rules, in neutral research language.",
    "Scoring: on_protocol (85-100) = meal is consistent with the protocol; partial_deviation (50-84) = mostly consistent but includes at least one item or quantity outside the protocol; off_protocol (0-49) = meal is largely inconsistent with the protocol.",
    "If the image is not a food photo, set is_food_photo=false, match_status=off_protocol, score=0, and explain that no meal could be identified.",
    "If the image appears to include people, faces, or identifiable surroundings, set privacy_flag=true (the platform asks participants to photograph the plate only).",
    "Rule checks: after itemizing the meal and estimating portions, evaluate each explicit protocol rule one by one — energy range, sodium limit, excluded foods, limited food groups, emphasized food groups (only those the protocol actually defines) — and report each as a rule_check with pass, fail, or unclear plus a very short factual detail. The overall match_status must follow from these checks: any excluded-food fail means off_protocol; a limit or range fail with the rest passing means partial_deviation.",
    "Base your assessment only on what is visible plus the participant's optional note. When uncertain about an item, say so in the reason rather than guessing confidently.",
    "Confidence: report high only when the items and the protocol comparison are both clear. Report medium when some items or portions are uncertain but the overall judgment is solid. Report low when the photo is unclear, items are ambiguous, or the comparison hinges on details you cannot see. Use low deliberately — low-confidence matches are routed to a human reviewer instead of being scored automatically, so a truthful 'low' is more valuable than a guessed 'high'.",
  ].join("\n");
}

function protocolToText(protocol) {
  const lines = [`Study protocol: ${protocol.dietName || "Unnamed protocol"}`];
  if (protocol.summary) lines.push(`Summary: ${protocol.summary}`);
  if (protocol.caloriesPerMealMin || protocol.caloriesPerMealMax) {
    lines.push(
      `Target energy per meal: ${protocol.caloriesPerMealMin ?? "?"}–${protocol.caloriesPerMealMax ?? "?"} kcal`
    );
  }
  if (protocol.sodiumLimitMg) {
    lines.push(`Sodium limit per meal: ${protocol.sodiumLimitMg} mg (flag visibly high-sodium items: cured meats, canned soups, heavily sauced or fast food)`);
  }
  if (protocol.macros && (protocol.macros.carbs || protocol.macros.protein || protocol.macros.fat)) {
    lines.push(
      `Approximate macro targets: ${protocol.macros.carbs ?? "–"}% carbohydrate / ${protocol.macros.protein ?? "–"}% protein / ${protocol.macros.fat ?? "–"}% fat`
    );
  }
  if (protocol.emphasize?.length) lines.push(`Food groups to emphasize: ${protocol.emphasize.join(", ")}`);
  if (protocol.limit?.length) lines.push(`Food groups to limit: ${protocol.limit.join(", ")}`);
  if (protocol.excludedFoods?.length) lines.push(`Explicitly excluded foods: ${protocol.excludedFoods.join(", ")}`);
  if (protocol.notes) lines.push(`Additional protocol notes: ${protocol.notes}`);
  return lines.join("\n");
}

function hasCredentials() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}

async function analyzeWithGemini({ imageBase64, mediaType, note, protocol }) {
  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  const model = client.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: buildSystemPrompt(),
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESULT_SCHEMA,
    },
  });

  const promptText = [
    protocolToText(protocol),
    note ? `Participant note (optional, self-reported): ${note}` : "Participant provided no note.",
    "Analyze the meal photo against this protocol and return the structured result.",
  ].join("\n\n");

  const response = await model.generateContent([
    { inlineData: { mimeType: mediaType || "image/jpeg", data: imageBase64 } },
    { text: promptText },
  ]);

  const text = response.response.text();
  if (!text) throw new Error("Empty model response.");
  return JSON.parse(text);
}

// ---------------------------------------------------------------------------
// Simulated analyzer — deterministic fallback so the demo works offline.
// Uses the participant note (if any) against the protocol's excluded/limited
// lists; otherwise produces a stable pseudo-random plausible result.
// ---------------------------------------------------------------------------

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const GENERIC_ITEMS = [
  [
    { name: "Mixed green salad", estimated_portion: "~2 cups" },
    { name: "Grilled chicken breast", estimated_portion: "1 piece (~120 g)" },
    { name: "Olive oil dressing", estimated_portion: "~1 tbsp" },
  ],
  [
    { name: "Baked salmon fillet", estimated_portion: "1 fillet (~150 g)" },
    { name: "Steamed broccoli", estimated_portion: "~1 cup" },
    { name: "Brown rice", estimated_portion: "~3/4 cup" },
  ],
  [
    { name: "Whole-grain pasta", estimated_portion: "~1.5 cups" },
    { name: "Tomato sauce", estimated_portion: "~1/2 cup" },
    { name: "Parmesan cheese", estimated_portion: "~2 tbsp" },
  ],
  [
    { name: "Cheeseburger", estimated_portion: "1 sandwich" },
    { name: "French fries", estimated_portion: "1 medium serving" },
  ],
  [
    { name: "Vegetable stir-fry", estimated_portion: "~2 cups" },
    { name: "Tofu", estimated_portion: "~100 g" },
    { name: "White rice", estimated_portion: "~1 cup" },
  ],
];

const UNCERTAINTY_WORDS = ["blurry", "blurred", "dark", "dim", "unclear", "hard to see", "mixed dish", "leftovers"];

function simulateAnalysis({ imageBase64, note, protocol }) {
  const seedSource = (note || "") + (imageBase64 ? imageBase64.slice(0, 512) : "trewel");
  const h = hashString(seedSource);
  const noteLower = (note || "").toLowerCase();

  // If the note names an explicitly excluded food, that decides the outcome.
  const excludedHit = (protocol.excludedFoods || []).find(
    (f) => f && noteLower.includes(f.toLowerCase())
  );
  const limitedHit = (protocol.limit || []).find(
    (f) => f && noteLower.includes(f.toLowerCase())
  );

  // Confidence: uncertainty cues in the note force low; explicit protocol
  // hits are clear evidence (high); otherwise a stable pseudo-random split.
  let confidence;
  if (UNCERTAINTY_WORDS.some((w) => noteLower.includes(w))) confidence = "low";
  else if (excludedHit || limitedHit) confidence = "high";
  else {
    const cr = (h >>> 8) % 100;
    confidence = cr < 10 ? "low" : cr < 26 ? "medium" : "high";
  }

  let items = GENERIC_ITEMS[h % GENERIC_ITEMS.length];
  let match_status;
  let score;
  let reason;

  if (excludedHit) {
    match_status = "off_protocol";
    score = 25 + (h % 15);
    items = [{ name: excludedHit, estimated_portion: "1 serving" }, ...items.slice(0, 1)];
    reason = `The logged meal appears to include ${excludedHit}, which is explicitly excluded under this study's protocol.`;
  } else if (limitedHit) {
    match_status = "partial_deviation";
    score = 55 + (h % 20);
    reason = `The meal appears mostly consistent with the protocol, but includes ${limitedHit}, a food group the protocol asks participants to limit.`;
  } else {
    const roll = h % 10;
    if (roll < 6) {
      match_status = "on_protocol";
      score = 86 + (h % 13);
      reason = "The visible items are consistent with the study protocol; no excluded foods or clear limit violations were identified.";
    } else if (roll < 9) {
      match_status = "partial_deviation";
      score = 58 + (h % 22);
      reason = "Most of the meal is consistent with the protocol, but one item appears to fall outside the study's targets (for example, a likely high-sodium or refined-grain component).";
    } else {
      match_status = "off_protocol";
      score = 30 + (h % 18);
      reason = "Several visible items appear inconsistent with the study protocol for this meal.";
    }
  }

  if (confidence === "low") {
    reason += " The photo made some items difficult to identify with certainty, so this match is held for reviewer confirmation.";
  }

  return {
    is_food_photo: true,
    privacy_flag: false,
    identified_items: items,
    rule_checks: simulatedRuleChecks(protocol, { excludedHit, limitedHit, match_status, confidence, h }),
    match_status,
    confidence,
    score,
    reason,
  };
}

// Deterministic per-rule verdicts, kept consistent with the overall status:
// on_protocol → every defined rule passes; partial → exactly one limit/range
// rule fails; off → the excluded-foods rule fails.
function simulatedRuleChecks(protocol, { excludedHit, limitedHit, match_status, confidence, h }) {
  const checks = [];
  const off = match_status === "off_protocol";
  const partial = match_status === "partial_deviation";
  let partialUsed = false;

  if (protocol.caloriesPerMealMin || protocol.caloriesPerMealMax) {
    const fail = partial && !limitedHit && h % 3 === 0 && !partialUsed;
    if (fail) partialUsed = true;
    checks.push({
      rule: "Energy range",
      result: fail ? "fail" : confidence === "low" ? "unclear" : "pass",
      detail: fail ? "portion appears above target range" : confidence === "low" ? "portions hard to estimate" : "within target range",
    });
  }
  if (protocol.sodiumLimitMg) {
    const fail = partial && !limitedHit && !partialUsed;
    if (fail) partialUsed = true;
    checks.push({
      rule: "Sodium limit",
      result: fail ? "fail" : off ? "unclear" : "pass",
      detail: fail ? "likely high-sodium item present" : off ? "not assessed — excluded item present" : "no visibly high-sodium items",
    });
  }
  if (protocol.excludedFoods?.length) {
    checks.push({
      rule: "Excluded foods",
      result: off ? "fail" : "pass",
      detail: off ? `${excludedHit || "excluded item"} detected` : "none detected",
    });
  }
  if (protocol.limit?.length) {
    const fail = Boolean(limitedHit) || (partial && !partialUsed);
    checks.push({
      rule: "Limited food groups",
      result: fail ? "fail" : "pass",
      detail: fail ? `${limitedHit || "limited item"} present` : "within plan",
    });
  }
  if (protocol.emphasize?.length) {
    checks.push({
      rule: "Emphasized food groups",
      result: off ? "unclear" : "pass",
      detail: off ? "meal centered on excluded items" : "meal built around plan foods",
    });
  }
  return checks;
}

// ---------------------------------------------------------------------------

export async function analyzeMeal(payload) {
  const { imageBase64, protocol } = payload || {};
  if (!protocol) throw new Error("Missing protocol.");
  if (!imageBase64) throw new Error("Missing image.");

  if (hasCredentials()) {
    try {
      const result = await analyzeWithGemini(payload);
      return { engine: "gemini", result };
    } catch (err) {
      console.warn("[trewel] Gemini analysis failed, using simulated analyzer:", err?.message);
      return { engine: "simulated", result: simulateAnalysis(payload) };
    }
  }
  return { engine: "simulated", result: simulateAnalysis(payload) };
}

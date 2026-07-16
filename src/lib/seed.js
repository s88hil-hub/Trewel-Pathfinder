// Deterministic seed data so the dashboard is populated on first load.
// Meals are generated relative to "now" so charts always look current.
// v2: meals carry AI confidence + review state; studies carry researcher
// response templates; the workspace carries an audit log and settings.

import { PROTOCOL_LIBRARY } from "./protocolTemplates.js";

const DAY_MS = 24 * 60 * 60 * 1000;
export const SEED_VERSION = 2;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

export function makeParticipantCode(prefix, rand = Math.random) {
  let s = "";
  for (let i = 0; i < 4; i++) s += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  return `${prefix}-${s}`;
}

const MED_MEALS = {
  on: [
    { items: [{ name: "Grilled salmon", estimated_portion: "1 fillet (~150 g)" }, { name: "Roasted vegetables", estimated_portion: "~1.5 cups" }, { name: "Olive oil", estimated_portion: "~1 tbsp" }], reason: "Fish, vegetables, and olive oil are all emphasized under this protocol; no excluded items identified." },
    { items: [{ name: "Greek salad", estimated_portion: "~2 cups" }, { name: "Feta cheese", estimated_portion: "~30 g" }, { name: "Whole-grain pita", estimated_portion: "1 piece" }], reason: "Vegetables, moderate dairy, and whole grains are consistent with the protocol." },
    { items: [{ name: "Lentil soup", estimated_portion: "~1.5 cups" }, { name: "Whole-grain bread", estimated_portion: "1 slice" }], reason: "Legumes and whole grains are emphasized food groups under this protocol." },
    { items: [{ name: "Chicken and vegetable skewers", estimated_portion: "2 skewers" }, { name: "Bulgur salad", estimated_portion: "~1 cup" }], reason: "Lean poultry and whole grains fall within the protocol's targets." },
  ],
  partial: [
    { items: [{ name: "Pasta with tomato sauce", estimated_portion: "~2 cups" }, { name: "Garlic bread", estimated_portion: "2 slices" }], reason: "The portion appears large and the bread appears to be refined-grain, which the protocol asks participants to limit." },
    { items: [{ name: "Beef stir-fry", estimated_portion: "~1.5 cups" }, { name: "White rice", estimated_portion: "~1 cup" }], reason: "Red meat is a limited food group under this protocol; the rest of the meal is consistent." },
    { items: [{ name: "Cheese omelette", estimated_portion: "3 eggs" }, { name: "Buttered toast", estimated_portion: "2 slices" }], reason: "Butter and refined grains fall outside the protocol's emphasis on olive oil and whole grains." },
  ],
  off: [
    { items: [{ name: "Cheeseburger", estimated_portion: "1 sandwich" }, { name: "French fries", estimated_portion: "1 medium serving" }], reason: "Processed fast food is explicitly excluded under this study's protocol." },
    { items: [{ name: "Pepperoni pizza", estimated_portion: "3 slices" }, { name: "Soft drink", estimated_portion: "~500 ml" }], reason: "This meal includes processed meat and a sugary drink, both excluded under the protocol." },
  ],
};

const DASH_MEALS = {
  on: [
    { items: [{ name: "Baked chicken breast", estimated_portion: "~120 g" }, { name: "Steamed green beans", estimated_portion: "~1 cup" }, { name: "Sweet potato", estimated_portion: "1 medium" }], reason: "Fresh, unprocessed items with no visibly high-sodium components; consistent with the sodium-restricted protocol." },
    { items: [{ name: "Oatmeal with berries", estimated_portion: "~1.5 cups" }, { name: "Low-fat yogurt", estimated_portion: "~170 g" }], reason: "Whole grains, fruit, and low-fat dairy are emphasized under this protocol." },
    { items: [{ name: "Quinoa bowl", estimated_portion: "~2 cups" }, { name: "Avocado", estimated_portion: "1/2" }, { name: "Fresh vegetables", estimated_portion: "~1 cup" }], reason: "No excluded or visibly high-sodium items identified; consistent with the protocol." },
  ],
  partial: [
    { items: [{ name: "Turkey sandwich", estimated_portion: "1 sandwich" }, { name: "Pickle", estimated_portion: "1 spear" }], reason: "Deli turkey and pickles are typically high in sodium, which likely places this meal above the per-meal sodium target." },
    { items: [{ name: "Vegetable soup (canned)", estimated_portion: "~1.5 cups" }, { name: "Crackers", estimated_portion: "~10" }], reason: "Canned soup appears to be a high-sodium item, which is outside this study's sodium target." },
  ],
  off: [
    { items: [{ name: "Instant ramen", estimated_portion: "1 bowl" }, { name: "Processed ham", estimated_portion: "2 slices" }], reason: "Instant noodles and cured meat are explicitly excluded high-sodium items under this protocol." },
    { items: [{ name: "Fried chicken", estimated_portion: "2 pieces" }, { name: "Biscuit", estimated_portion: "1" }], reason: "Fast food is excluded under this protocol and is typically well above the per-meal sodium limit." },
  ],
};

const LOW_CONF_SUFFIX =
  " The photo made some items difficult to identify with certainty, so this match is held for reviewer confirmation.";

function makeMeal(rand, ts, bucket, library) {
  let status, score, pool;
  if (bucket === "on") {
    status = "on_protocol"; score = 86 + Math.floor(rand() * 14); pool = library.on;
  } else if (bucket === "partial") {
    status = "partial_deviation"; score = 55 + Math.floor(rand() * 28); pool = library.partial;
  } else {
    status = "off_protocol"; score = 22 + Math.floor(rand() * 24); pool = library.off;
  }
  const pick = pool[Math.floor(rand() * pool.length)];

  // Confidence split: mostly high, some medium, a few low.
  const cr = rand();
  const confidence = cr < 0.08 ? "low" : cr < 0.24 ? "medium" : "high";

  // Review state: low-confidence meals are routed to human review. Older
  // ones were already handled by the researcher; recent ones are pending.
  let review = { state: "auto_confirmed" };
  let reason = pick.reason;
  if (confidence === "low") {
    reason += LOW_CONF_SUFFIX;
    const ageDays = (Date.now() - ts) / DAY_MS;
    if (ageDays > 2.5) {
      review = rand() < 0.75
        ? { state: "confirmed", reviewedAt: ts + 6 * 3600 * 1000, by: "s.chen@university.edu" }
        : { state: "corrected", reviewedAt: ts + 6 * 3600 * 1000, by: "s.chen@university.edu", original: { status, score } };
      if (review.state === "corrected") {
        // Researcher judged it one band stricter than the AI proposed.
        if (status === "on_protocol") { status = "partial_deviation"; score = 65; }
        else { status = "off_protocol"; score = 30; }
      }
    } else {
      review = { state: "pending" };
    }
  }

  return {
    id: `meal_${ts}_${Math.floor(rand() * 1e6)}`,
    timestamp: ts,
    photo: null, // seeded meals render a placeholder plate illustration
    note: "",
    engine: "seeded",
    result: {
      is_food_photo: true,
      privacy_flag: false,
      identified_items: pick.items,
      match_status: status,
      confidence,
      score,
      reason,
    },
    review,
  };
}

// profile: { base: probability of on-protocol early on, drift: change over time }
function makeMealHistory(rand, library, profile, days = 14) {
  const meals = [];
  const now = Date.now();
  for (let i = days; i >= 1; i--) {
    const mealsToday = rand() < 0.25 ? 3 : 2;
    const progress = (days - i) / days; // 0 (oldest) → 1 (newest)
    const pOn = Math.min(0.95, Math.max(0.05, profile.base + profile.drift * progress));
    for (let m = 0; m < mealsToday; m++) {
      const hour = m === 0 ? 8 : m === 1 ? 13 : 19;
      const ts = now - i * DAY_MS + (hour + rand() * 1.5) * 3600 * 1000;
      const roll = rand();
      const bucket = roll < pOn ? "on" : roll < pOn + (1 - pOn) * 0.65 ? "partial" : "off";
      meals.push(makeMeal(rand, Math.floor(ts), bucket, library));
    }
  }
  return meals.sort((a, b) => a.timestamp - b.timestamp);
}

const findLib = (id) => PROTOCOL_LIBRARY.find((t) => t.id === id);

export function buildSeedData() {
  const rand = mulberry32(20260714);
  const now = Date.now();

  const medStudy = {
    id: "st_med24",
    name: "MED-24 · Mediterranean Diet Adherence Study",
    description:
      "12-week free-living trial evaluating whether photo-verified adherence scoring improves data quality versus self-reported diaries in a Mediterranean-diet intervention arm.",
    createdAt: now - 21 * DAY_MS,
    codePrefix: "MED24",
    protocol: {
      ...findLib("mediterranean").protocol,
      notes: "Wine is out of scope for this demo protocol. Participants log all main meals; snacks optional.",
    },
    participants: [],
  };

  const dashStudy = {
    id: "st_ls11",
    name: "LS-11 · Low-Sodium DASH Feasibility Pilot",
    description:
      "4-week feasibility pilot testing photo-based verification of a sodium-restricted DASH-style eating pattern in adults with elevated blood pressure (protocol adherence only — no clinical endpoints).",
    createdAt: now - 16 * DAY_MS,
    codePrefix: "LS11",
    protocol: { ...findLib("low-sodium").protocol },
    participants: [],
  };

  const participants = {};

  const medProfiles = [
    { base: 0.85, drift: 0.05 },  // steady, on track
    { base: 0.75, drift: 0.1 },   // improving
    { base: 0.8, drift: -0.45 },  // trending off-protocol
    { base: 0.45, drift: -0.1 },  // struggling
    { base: 0.7, drift: 0.0 },    // middling
  ];
  const dashProfiles = [
    { base: 0.9, drift: 0.0 },    // excellent
    { base: 0.6, drift: 0.25 },   // improving
    { base: 0.35, drift: -0.05 }, // off-protocol
  ];

  for (const profile of medProfiles) {
    const code = makeParticipantCode(medStudy.codePrefix, rand);
    participants[code] = {
      code,
      studyId: medStudy.id,
      joinedAt: now - 15 * DAY_MS,
      meals: makeMealHistory(rand, MED_MEALS, profile),
    };
    medStudy.participants.push(code);
  }
  for (const profile of dashProfiles) {
    const code = makeParticipantCode(dashStudy.codePrefix, rand);
    participants[code] = {
      code,
      studyId: dashStudy.id,
      joinedAt: now - 14 * DAY_MS,
      meals: makeMealHistory(rand, DASH_MEALS, profile),
    };
    dashStudy.participants.push(code);
  }

  // Seed audit trail — the workspace's ledger of who did what.
  const audit = [
    { id: "aud_1", ts: medStudy.createdAt, actor: "s.chen@university.edu", action: "Study created", target: medStudy.name },
    { id: "aud_2", ts: now - 15 * DAY_MS, actor: "s.chen@university.edu", action: "Participants enrolled", target: `${medStudy.participants.length} codes · ${medStudy.name.split("·")[0].trim()}` },
    { id: "aud_3", ts: dashStudy.createdAt, actor: "s.chen@university.edu", action: "Study created", target: dashStudy.name },
    { id: "aud_4", ts: now - 14 * DAY_MS, actor: "s.chen@university.edu", action: "Participants enrolled", target: `${dashStudy.participants.length} codes · ${dashStudy.name.split("·")[0].trim()}` },
    { id: "aud_5", ts: now - 4 * DAY_MS, actor: "s.chen@university.edu", action: "Reviewed low-confidence matches", target: "Review queue" },
  ];

  return {
    version: SEED_VERSION,
    seededAt: now,
    studies: { [medStudy.id]: medStudy, [dashStudy.id]: dashStudy },
    participants,
    audit,
    settings: { retentionDays: 90 },
  };
}

// Adherence rollups. A participant's adherence score is the rolling average of
// meal-level AI match scores, reported as daily and weekly aggregates.
//
// Trust rule: a low-confidence AI match enters a "pending review" state and is
// EXCLUDED from every adherence figure until a researcher confirms or corrects
// it. Only scorable meals feed the numbers below.

const DAY_MS = 24 * 60 * 60 * 1000;

export function mealIsPending(meal) {
  return meal?.review?.state === "pending";
}

export function scorableMeals(meals) {
  return meals.filter((m) => !mealIsPending(m));
}

export function dayKey(ts) {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function dayLabel(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Continuous daily series for the last `days` days (oldest → newest).
// Days without scorable meals carry score: null so charts show gaps honestly.
export function dailySeries(meals, days = 14) {
  const byDay = new Map();
  for (const meal of scorableMeals(meals)) {
    const k = dayKey(meal.timestamp);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(meal.result.score);
  }
  const out = [];
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const k = dayKey(today.getTime() - i * DAY_MS);
    const scores = byDay.get(k);
    out.push({
      key: k,
      label: dayLabel(k),
      score: scores ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      meals: scores ? scores.length : 0,
    });
  }
  return out;
}

// Weekly rollups (weeks starting Monday), oldest → newest.
export function weeklyRollup(meals, weeks = 4) {
  const byWeek = new Map();
  for (const meal of scorableMeals(meals)) {
    const d = new Date(meal.timestamp);
    const monday = new Date(d);
    const dow = (d.getDay() + 6) % 7; // Mon=0
    monday.setDate(d.getDate() - dow);
    monday.setHours(0, 0, 0, 0);
    const k = dayKey(monday.getTime());
    if (!byWeek.has(k)) byWeek.set(k, []);
    byWeek.get(k).push(meal.result.score);
  }
  const out = [];
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - dow);
  thisMonday.setHours(0, 0, 0, 0);
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisMonday.getTime() - i * 7 * DAY_MS);
    const k = dayKey(start.getTime());
    const scores = byWeek.get(k);
    out.push({
      key: k,
      label: `Wk of ${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
      score: scores ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      meals: scores ? scores.length : 0,
    });
  }
  return out;
}

// Rolling adherence: mean scorable meal score over the trailing 7 days.
export function currentAdherence(meals) {
  const cutoff = Date.now() - 7 * DAY_MS;
  const recent = scorableMeals(meals).filter((m) => m.timestamp >= cutoff);
  if (!recent.length) return null;
  return Math.round(recent.reduce((a, m) => a + m.result.score, 0) / recent.length);
}

// Trend: mean of last 3 days vs mean of the 4 days before that.
export function trendDelta(meals) {
  const series = dailySeries(meals, 7).filter((d) => d.score != null);
  if (series.length < 4) return null;
  const recent = series.slice(-3);
  const prior = series.slice(0, -3);
  const avg = (arr) => arr.reduce((a, d) => a + d.score, 0) / arr.length;
  return Math.round(avg(recent) - avg(prior));
}

// Visual flag for the researcher dashboard. Color never carries meaning
// alone — every flag renders with an icon + text label (see StatusPill).
export function adherenceFlag(meals) {
  const score = currentAdherence(meals);
  const delta = trendDelta(meals);
  if (score == null) return { level: "nodata", label: "No recent data", score, delta };
  if (score < 65) return { level: "critical", label: "Off-protocol", score, delta };
  if (delta != null && delta <= -10 && score < 85) return { level: "serious", label: "Trending off-protocol", score, delta };
  if (score < 80) return { level: "warning", label: "Watch", score, delta };
  return { level: "good", label: "On track", score, delta };
}

export const STATUS_META = {
  on_protocol: { label: "On protocol", level: "good" },
  partial_deviation: { label: "Partial deviation", level: "warning" },
  off_protocol: { label: "Off protocol", level: "critical" },
};

export const CONFIDENCE_META = {
  high: { label: "High confidence", dots: 3 },
  medium: { label: "Medium confidence", dots: 2 },
  low: { label: "Low confidence", dots: 1 },
};

// Score assigned when a researcher corrects a match to a different status —
// the midpoint of that status's scoring band, so corrections are consistent.
export const CORRECTION_SCORES = {
  on_protocol: 90,
  partial_deviation: 65,
  off_protocol: 30,
};

// Verification transparency: how much did the AI handle on its own, and how
// much did it route to a human? Framed as a feature — the system knows its
// own limits.
export function reviewStats(meals) {
  const total = meals.length;
  if (!total) return { total: 0, autoPct: 100, flaggedPct: 0, pending: 0, reviewed: 0 };
  let flagged = 0, pending = 0, reviewed = 0;
  for (const m of meals) {
    const state = m.review?.state || "auto_confirmed";
    if (state !== "auto_confirmed") {
      flagged++;
      if (state === "pending") pending++;
      else reviewed++;
    }
  }
  const autoPct = Math.round(((total - flagged) / total) * 100);
  return { total, autoPct, flaggedPct: 100 - autoPct, pending, reviewed };
}

// Participant weekly personal summary — their OWN data, reflective not
// prescriptive.
export function weekSummary(meals) {
  const series = dailySeries(meals, 7);
  const logged = series.filter((d) => d.meals > 0);
  const onDays = logged.filter((d) => d.score >= 80).length;
  const mealCount = logged.reduce((a, d) => a + d.meals, 0);
  const cutoff = Date.now() - 7 * DAY_MS;
  const pendingCount = meals.filter((m) => mealIsPending(m) && m.timestamp >= cutoff).length;
  return { daysLogged: logged.length, onDays, mealCount, pendingCount };
}

# Trewel

**Objective dietary adherence for nutrition research.** Trewel replaces self-reported food
diaries with AI-verified, protocol-matched photo logging: participants photograph their plate,
a multimodal AI checks the photo against the researcher-defined diet protocol, and researchers
get an ongoing, objective adherence score instead of trusting self-report.

Trewel is a **research support / data-collection tool** — it does not diagnose, advise, or treat.
It logs meals and scores adherence against a protocol the researcher defines.

## Run it

```bash
npm install
npm run dev          # → http://localhost:5173 (or the port Vite prints)
```

**Live AI analysis (optional).** If `ANTHROPIC_API_KEY` is set in the environment when the dev
server starts, meal photos are analyzed by a real multimodal Claude call (`claude-opus-4-8`,
vision + JSON-schema structured output). Without a key, an offline **simulated analyzer** keeps
the full demo flow working, and every simulated assessment is labeled as such in the UI.

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # optional
npm run dev
```

## Trust & safety layer

Every AI match carries a **confidence level** (high / medium / low — never a fake-precise
percentage). Low-confidence matches do **not** count toward adherence: they enter a pending state
and land in the researcher **review queue** (`/researcher/review`), where one tap confirms the
AI's proposal or corrects it — the participant's real score updates immediately and the decision
is audit-logged. The dashboard reports this openly ("92% auto-verified · 8% routed to human
review") — the system knows its own limits. To demo the low-confidence path, include a word like
"blurry" in the meal note.

Participant-facing deviation feedback is **researcher-pre-authored template text only** (written
during study setup, keyword-matched to the violation). The AI reports protocol-comparison facts;
it never generates its own dietary guidance.

## Researcher workflow

- **Protocol templates:** start a study from Mediterranean, DASH, low-sodium, or time-restricted
  eating presets (each ships with editable response templates), or from a blank protocol.
- **Data handling / IRB panel** (`/researcher/data-handling`): what Trewel collects, retention
  setting + immediate deletion, a live audit log (sign-ins, enrollment, review decisions,
  exports), and a downloadable one-page data-handling summary for an IRB office.
- **REDCap-compatible export:** per-study meal-log CSV (repeating `meal_log` instrument keyed by
  participant code) plus a matching REDCap data dictionary, from the study page.

## Demo walkthrough

1. **Researcher** → sign in (any password) → two pre-seeded studies (MED-24, LS-11) with 14 days
   of adherence data. Open a study: study-wide daily adherence chart, exportable protocol,
   sortable participant table with off-protocol flags. Click a participant for their
   meal-by-meal log with photos and match results.
2. **Create study** → define the diet protocol as structured rules (energy/sodium limits, macro
   targets, food groups to emphasize/limit, explicitly excluded foods). Export it as JSON.
   **Add participant** generates an anonymous code (no names/emails) plus a join link.
3. **Participant** → enter a code (demo codes are shown on the join screen) → see the assigned
   protocol in plain language → **Log a meal**: photograph the plate (UI actively discourages
   capturing people/surroundings), optional note, submit → immediate AI assessment: identified
   items with rough portions, on-protocol / partial deviation / off-protocol status, a
   plain-language reason, and a 0–100 score contribution.
4. The logged meal immediately appears in the participant's history and on the researcher's
   dashboards (adherence = rolling 7-day mean of meal scores; daily + weekly rollups).

## Architecture

```
server/analyzeMeal.mjs   ← the isolated AI matching module (swap this to productionize)
vite.config.js           ← dev middleware exposing it at POST /api/analyze-meal
src/lib/api.js           ← client bridge + photo downscaler
src/lib/adherence.js     ← daily/weekly rollups, rolling score, flag logic
src/lib/seed.js          ← deterministic demo data
src/lib/store.jsx        ← app state (localStorage-persisted)
src/components/charts.jsx← hand-rolled SVG charts (line, weekly bars, sparklines)
src/pages/…              ← researcher console + participant app
```

The AI matcher returns a strict JSON shape (`match_status`, `score`, `identified_items[]`,
`reason`, `is_food_photo`, `privacy_flag`) enforced via structured outputs, so the scoring
pipeline is model-agnostic and easy to swap.

## Design

Trewel's identity is "the verification record" — lab-notebook paper meets journal typesetting.
Cool laboratory-paper surfaces with a faint graph grid; iron-ink text and buttons; one verdigris
accent (`#136f63`) reserved for links, the data series, and verified status; ochre and madder as
ink-like deviation/off-protocol tones. Type: STIX Two Text (the scientific-publishing serif) for
display, IBM Plex Sans for UI, IBM Plex Mono for every score, code, timestamp, and axis figure.
The signature moment: meal photos are framed with registration crop-marks and mono specimen
captions, and the AI verdict renders as a graduated instrument dial sweeping to the score beside
a stamped verdict box (motion respects `prefers-reduced-motion`).

## Data handling

This is a prototype: all study data, including photos, lives in the browser's localStorage;
photos are sent only to the analysis endpoint. Real deployment would require IRB approval and
institutional data-use agreements covering photo capture, storage, and retention. Participant
identifiers are anonymous codes by design.

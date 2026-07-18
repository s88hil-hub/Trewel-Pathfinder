import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Layout, StatusPill, ResearcherNav, useLingo } from "../components/ui.jsx";
import { AdherenceLineChart, Sparkline } from "../components/charts.jsx";
import { useWorkspace } from "../lib/store.jsx";
import { adherenceFlag, currentAdherence, dailySeries, weeklyRollup, mealIsPending } from "../lib/adherence.js";
import { buildRedcapCsv, buildRedcapDictionary, downloadFile } from "../lib/exports.js";

function ProtocolCard({ study, participants, onExportLogged, research }) {
  const p = study.protocol;
  function exportJson() {
    downloadFile(
      `${(study.codePrefix || "trewel").toLowerCase()}-protocol.json`,
      JSON.stringify({ study: study.name, protocol: p }, null, 2),
      "application/json"
    );
    onExportLogged("Exported protocol JSON", study.name);
  }
  function exportRedcap() {
    downloadFile(
      `${(study.codePrefix || "trewel").toLowerCase()}-meal-log-redcap.csv`,
      buildRedcapCsv(study, participants),
      "text/csv"
    );
    onExportLogged("Exported REDCap data CSV", study.name);
  }
  function exportDictionary() {
    downloadFile("trewel-meal-log-data-dictionary.csv", buildRedcapDictionary(), "text/csv");
    onExportLogged("Exported REDCap data dictionary", study.name);
  }
  return (
    <div className="card">
      <div className="card-title-row">
        <div>
          <div className="card-kicker">Plan rules</div>
          <h2>{p.dietName}</h2>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {research ? (
            <>
              <button className="btn btn--secondary btn--small" onClick={exportRedcap}>Export data (REDCap CSV)</button>
              <button className="btn btn--secondary btn--small" onClick={exportDictionary}>Data dictionary</button>
            </>
          ) : null}
          <button className="btn btn--secondary btn--small" onClick={exportJson}>Plan JSON</button>
        </div>
      </div>
      <p className="small" style={{ marginTop: 0 }}>{p.summary}</p>
      <div className="protocol-grid">
        {(p.caloriesPerMealMin || p.caloriesPerMealMax) ? (
          <div className="protocol-item"><div className="k">Energy per meal</div><div className="v">{p.caloriesPerMealMin ?? "—"}–{p.caloriesPerMealMax ?? "—"} kcal</div></div>
        ) : null}
        {p.sodiumLimitMg ? (
          <div className="protocol-item"><div className="k">Sodium limit / meal</div><div className="v">{p.sodiumLimitMg} mg</div></div>
        ) : null}
        {p.macros && (p.macros.carbs || p.macros.protein || p.macros.fat) ? (
          <div className="protocol-item"><div className="k">Macro targets</div><div className="v">{p.macros.carbs ?? "–"}% C · {p.macros.protein ?? "–"}% P · {p.macros.fat ?? "–"}% F</div></div>
        ) : null}
        {p.emphasize?.length ? (
          <div className="protocol-item"><div className="k">Emphasize</div><div className="v">{p.emphasize.join(", ")}</div></div>
        ) : null}
        {p.limit?.length ? (
          <div className="protocol-item"><div className="k">Limit</div><div className="v">{p.limit.join(", ")}</div></div>
        ) : null}
        {p.excludedFoods?.length ? (
          <div className="protocol-item"><div className="k">Excluded</div><div className="v">{p.excludedFoods.join(", ")}</div></div>
        ) : null}
        {p.responseTemplates?.length ? (
          <div className="protocol-item">
            <div className="k">Response templates</div>
            <div className="v">{p.responseTemplates.map((t) => t.name).join(" · ")}</div>
          </div>
        ) : null}
      </div>
      {p.notes ? <p className="muted small" style={{ marginBottom: 0 }}>{p.notes}</p> : null}
    </div>
  );
}

const COLUMNS = [
  { key: "code", label: "Code", sortable: true },
  { key: "meals", label: "Meals", sortable: true, num: true },
  { key: "last", label: "Last log", sortable: true },
  { key: "weekly", label: "Weekly avg (4w)", sortable: false },
  { key: "trend", label: "Daily trend (14d)", sortable: false },
  { key: "score", label: "Adherence (7d)", sortable: true, num: true },
  { key: "flag", label: "Status", sortable: true },
];

const FLAG_ORDER = { critical: 0, serious: 1, warning: 2, good: 3, nodata: 4 };

export default function StudyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, addParticipant, logAudit } = useWorkspace();
  const lingo = useLingo();
  const researchMode = data.settings.researchMode;
  const study = data.studies[id];
  const [sort, setSort] = useState({ key: "flag", dir: 1 });
  const [newCode, setNewCode] = useState(null);

  const rows = useMemo(() => {
    if (!study) return [];
    return study.participants
      .map((c) => data.participants[c])
      .filter(Boolean)
      .map((p) => {
        const flag = adherenceFlag(p.meals);
        const lastMeal = p.meals[p.meals.length - 1];
        const weekly = weeklyRollup(p.meals, 4).filter((w) => w.score != null);
        return {
          p,
          code: p.code,
          meals: p.meals.length,
          last: lastMeal ? lastMeal.timestamp : 0,
          score: flag.score ?? -1,
          flag,
          weeklyText: weekly.map((w) => w.score).join(" · ") || "—",
          series: dailySeries(p.meals, 14),
        };
      });
  }, [study, data.participants]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    const { key, dir } = sort;
    arr.sort((a, b) => {
      let va, vb;
      if (key === "flag") { va = FLAG_ORDER[a.flag.level]; vb = FLAG_ORDER[b.flag.level]; }
      else if (key === "code") { va = a.code; vb = b.code; }
      else { va = a[key]; vb = b[key]; }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return arr;
  }, [rows, sort]);

  if (!study) {
    return (
      <Layout context="Researcher console">
        <div className="empty">Study not found. <Link to="/researcher/dashboard">Back to studies</Link></div>
      </Layout>
    );
  }

  const allMeals = study.participants.flatMap((c) => data.participants[c]?.meals || []);
  const scores = rows.map((r) => (r.score >= 0 ? r.score : null)).filter((s) => s != null);
  const meanAdherence = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : "—";
  const flaggedCount = rows.filter((r) => r.flag.level === "critical" || r.flag.level === "serious").length;
  const pendingCount = allMeals.filter(mealIsPending).length;

  function onAddParticipant() {
    const code = addParticipant(study.id);
    setNewCode(code);
  }

  function setSortKey(key) {
    setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: 1 }));
  }

  return (
    <Layout context={lingo.console} headerRight={<ResearcherNav />}>
      <div className="section-head">
        <div>
          <div className="card-kicker"><Link to="/researcher/dashboard">← All {lingo.plansLower}</Link></div>
          <h1>{study.name}</h1>
          <p className="muted small" style={{ margin: "4px 0 0", maxWidth: 700 }}>{study.description}</p>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-tile"><div className="stat-label">{lingo.clients}</div><div className="stat-value">{rows.length}</div></div>
        <div className="stat-tile"><div className="stat-label">Meals logged</div><div className="stat-value">{allMeals.length}</div></div>
        <div className="stat-tile"><div className="stat-label">Mean adherence (7d)</div><div className="stat-value">{meanAdherence}</div></div>
        <div className="stat-tile">
          <div className="stat-label">Active flags</div>
          <div className="stat-value">{flaggedCount}</div>
          <div style={{ marginTop: 4 }}>
            {flaggedCount > 0
              ? <StatusPill level="serious" label="Needs review" />
              : <StatusPill level="good" label="All on track" />}
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Awaiting review</div>
          <div className="stat-value">{pendingCount}</div>
          <div style={{ marginTop: 4 }}>
            {pendingCount > 0
              ? <Link to="/researcher/review" className="small" style={{ fontWeight: 600 }}>Review queue →</Link>
              : <span className="muted small">Queue clear</span>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title-row">
          <h2>Study-wide daily adherence</h2>
          <span className="muted small">Mean of verified meal scores per day, last 14 days</span>
        </div>
        <AdherenceLineChart series={dailySeries(allMeals, 14)} />
      </div>

      <ProtocolCard study={study} participants={data.participants} onExportLogged={logAudit} research={researchMode} />

      <div className="section-head">
        <h2>{lingo.clients}</h2>
        <button className="btn" onClick={onAddParticipant}>+ {lingo.enrollVerb}</button>
      </div>

      {newCode ? (
        <div className="banner">
          <span>
            New {lingo.clientLower} code: <span className="code-chip">{newCode}</span> — share this code (or the
            join link <span className="code-chip">{window.location.origin}/participant/{newCode}</span>) with your
            {" "}{lingo.clientLower}. The code is their whole login; no name or email is stored.
          </span>
        </div>
      ) : null}

      <div className="card" style={{ padding: 8 }}>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} className={`${c.sortable ? "sortable" : ""} ${c.num ? "num" : ""}`}
                    onClick={c.sortable ? () => setSortKey(c.key) : undefined}>
                    {c.label}{sort.key === c.key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const rowCls =
                  r.flag.level === "critical" || r.flag.level === "serious" ? "row-flagged"
                  : r.flag.level === "warning" ? "row-watch"
                  : "";
                return (
                  <tr key={r.code} className={`rowlink ${rowCls}`} onClick={() => navigate(`/researcher/studies/${study.id}/participants/${r.code}`)}>
                    <td><span className="code-chip">{r.code}</span></td>
                    <td className="num">{r.meals}</td>
                    <td className="muted mono" style={{ fontSize: 12.5 }}>{r.last ? new Date(r.last).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}</td>
                    <td className="muted mono" style={{ fontSize: 12.5 }}>{r.weeklyText}</td>
                    <td><Sparkline series={r.series} /></td>
                    <td className="num" style={{ fontWeight: 600, fontSize: 15 }}>{r.score >= 0 ? r.score : "—"}</td>
                    <td><StatusPill level={r.flag.level} label={r.flag.label} /></td>
                  </tr>
                );
              })}
              {!sorted.length ? (
                <tr><td colSpan={COLUMNS.length} className="muted" style={{ textAlign: "center", padding: 24 }}>No {lingo.clientsLower} yet — generate an invite code above.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}

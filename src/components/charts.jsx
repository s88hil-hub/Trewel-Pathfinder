import { useEffect, useRef, useState, useMemo } from "react";

// Hand-rolled SVG charts, lab-instrument styling: 2px verdigris series
// line, hairline solid gridlines, mono axis figures, ≥8px markers with a
// paper ring, ≤24px columns with rounded data-ends, hover crosshair +
// tooltip. Text wears ink tokens, never the series color.

const MONO = "var(--font-mono)";

function useWidth(ref, fallback = 640) {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width;
      if (width) setW(width);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/* ------------------------------------------------------------------ */
/* Daily adherence line chart with crosshair + tooltip                 */
/* ------------------------------------------------------------------ */
export function AdherenceLineChart({ series, height = 220 }) {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const [hover, setHover] = useState(null);

  const pad = { top: 14, right: 18, bottom: 26, left: 38 };
  const innerW = Math.max(50, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;

  const pts = useMemo(() => {
    const n = series.length;
    return series.map((d, i) => ({
      ...d,
      x: pad.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW),
      y: d.score == null ? null : pad.top + innerH * (1 - d.score / 100),
    }));
  }, [series, innerW, innerH]);

  const drawn = pts.filter((p) => p.y != null);
  const path = drawn.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = drawn.length
    ? `${path} L${drawn[drawn.length - 1].x.toFixed(1)},${(pad.top + innerH).toFixed(1)} L${drawn[0].x.toFixed(1)},${(pad.top + innerH).toFixed(1)} Z`
    : "";
  const last = drawn[drawn.length - 1];

  const labelEvery = Math.max(1, Math.ceil(series.length / 4));

  function onMove(e) {
    const rect = wrapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let best = null;
    for (const p of pts) {
      if (p.y == null) continue;
      if (!best || Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
    }
    setHover(best);
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg width={width} height={height} role="img" aria-label="Daily adherence score">
        {/* gridlines — hairline, solid, recessive */}
        {[0, 25, 50, 75, 100].map((v) => {
          const y = pad.top + innerH * (1 - v / 100);
          return (
            <g key={v}>
              <line x1={pad.left} x2={pad.left + innerW} y1={y} y2={y}
                stroke={v === 0 ? "var(--rule-strong)" : "var(--rule)"} strokeWidth="1" />
              <text x={pad.left - 9} y={y + 3.5} textAnchor="end" fontSize="10"
                fill="var(--ink-muted)" style={{ fontFamily: MONO }}>{v}</text>
            </g>
          );
        })}
        {/* area wash */}
        {areaPath ? <path d={areaPath} fill="var(--accent)" opacity="0.07" /> : null}
        {/* the series line */}
        {path ? <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /> : null}
        {/* crosshair */}
        {hover ? (
          <line x1={hover.x} x2={hover.x} y1={pad.top} y2={pad.top + innerH} stroke="var(--rule-strong)" strokeWidth="1" />
        ) : null}
        {hover ? (
          <circle cx={hover.x} cy={hover.y} r="5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
        ) : null}
        {last && (!hover || hover.key !== last.key) ? (
          <circle cx={last.x} cy={last.y} r="4.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
        ) : null}
        {/* end label — the one direct label */}
        {last ? (
          last.x + 36 > width ? (
            <text x={last.x} y={last.y - 11} fontSize="11.5" fontWeight="600" fill="var(--ink)" textAnchor="end"
              style={{ fontFamily: MONO }}>{last.score}</text>
          ) : (
            <text x={last.x + 9} y={last.y + 4} fontSize="11.5" fontWeight="600" fill="var(--ink)" textAnchor="start"
              style={{ fontFamily: MONO }}>{last.score}</text>
          )
        ) : null}
        {/* x labels */}
        {pts.map((p, i) =>
          i % labelEvery === 0 || i === pts.length - 1 ? (
            <text key={p.key} x={p.x} y={height - 8} textAnchor="middle" fontSize="9.5"
              fill="var(--ink-muted)" style={{ fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {p.label}
            </text>
          ) : null
        )}
      </svg>
      {hover ? (
        <div className="chart-tooltip" style={{ left: hover.x, top: hover.y }}>
          <div className="tt-label">{hover.label}</div>
          <div><strong>{hover.score}</strong> adherence · {hover.meals} meal{hover.meals === 1 ? "" : "s"}</div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Weekly rollup columns                                               */
/* ------------------------------------------------------------------ */
export function WeeklyBars({ weeks, height = 170 }) {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef, 420);
  const pad = { top: 22, bottom: 34, left: 8, right: 8 };
  const innerH = height - pad.top - pad.bottom;
  const slot = (width - pad.left - pad.right) / Math.max(1, weeks.length);
  const barW = Math.min(24, slot * 0.5);

  return (
    <div ref={wrapRef}>
      <svg width={width} height={height} role="img" aria-label="Weekly adherence rollup">
        <line x1={pad.left} x2={width - pad.right} y1={pad.top + innerH} y2={pad.top + innerH}
          stroke="var(--rule-strong)" strokeWidth="1" />
        {weeks.map((wk, i) => {
          const cx = pad.left + slot * i + slot / 2;
          const baseY = pad.top + innerH;
          if (wk.score == null) {
            return (
              <g key={wk.key}>
                <text x={cx} y={baseY - 6} textAnchor="middle" fontSize="11" fill="var(--ink-muted)" style={{ fontFamily: MONO }}>–</text>
                <text x={cx} y={height - 16} textAnchor="middle" fontSize="9.5" fill="var(--ink-muted)"
                  style={{ fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.04em" }}>{wk.label}</text>
              </g>
            );
          }
          const h = Math.max(3, (wk.score / 100) * innerH);
          const r = Math.min(4, barW / 2, h);
          const x = cx - barW / 2;
          const y = baseY - h;
          const d = `M${x},${baseY} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + barW - r},${y} Q${x + barW},${y} ${x + barW},${y + r} L${x + barW},${baseY} Z`;
          return (
            <g key={wk.key}>
              <path d={d} fill="var(--accent)" />
              <text x={cx} y={y - 6} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="var(--ink)"
                style={{ fontFamily: MONO }}>{wk.score}</text>
              <text x={cx} y={height - 16} textAnchor="middle" fontSize="9.5" fill="var(--ink-muted)"
                style={{ fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.04em" }}>{wk.label}</text>
              <text x={cx} y={height - 4} textAnchor="middle" fontSize="9.5" fill="var(--ink-muted)" style={{ fontFamily: MONO }}>
                {wk.meals} meals
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sparkline — de-emphasis tint with the current point in the accent   */
/* ------------------------------------------------------------------ */
export function Sparkline({ series, width = 110, height = 30 }) {
  const drawn = series
    .map((d, i) => ({ ...d, i }))
    .filter((d) => d.score != null);
  if (!drawn.length) return <span className="muted small mono">—</span>;

  const x = (i) => 2 + (i / Math.max(1, series.length - 1)) * (width - 8);
  const y = (v) => 3 + (1 - v / 100) * (height - 6);
  const path = drawn.map((d, j) => `${j === 0 ? "M" : "L"}${x(d.i).toFixed(1)},${y(d.score).toFixed(1)}`).join(" ");
  const last = drawn[drawn.length - 1];
  return (
    <svg width={width} height={height} aria-hidden="true">
      <path d={path} fill="none" stroke="#a3c2ba" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last.i)} cy={y(last.score)} r="3" fill="var(--accent)" stroke="var(--surface)" strokeWidth="1.5" />
    </svg>
  );
}

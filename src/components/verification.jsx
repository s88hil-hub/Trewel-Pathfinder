import { useEffect, useRef, useState } from "react";
import { STATUS_META } from "../lib/adherence.js";

// ------------------------------------------------------------------
// The verification record — Trewel's signature visual moment.
// A meal photo becomes a labeled specimen (crop marks + mono caption),
// and the AI verdict renders as a graduated instrument dial that
// sweeps to the score beside a stamped verdict.
// ------------------------------------------------------------------

function prefersReducedMotion() {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const VERDICT = {
  on_protocol: { color: "var(--verified)", text: "var(--verified-text)", stamp: "stamp--good", label: "Verified · On protocol" },
  partial_deviation: { color: "var(--deviation)", text: "var(--deviation-text)", stamp: "stamp--warning", label: "Partial deviation" },
  off_protocol: { color: "var(--off)", text: "var(--off-text)", stamp: "stamp--critical", label: "Off protocol" },
};

/* ------------------------------------------------------------------ */
/* SpecimenPhoto — crop-marked figure with a mono caption              */
/* ------------------------------------------------------------------ */
export function SpecimenPhoto({ src, alt = "Logged meal photo", caption, children, style }) {
  return (
    <figure className="specimen" style={{ margin: 0, ...style }}>
      <div className="specimen-frame">
        {src ? <img src={src} alt={alt} /> : children}
        <span className="specimen-mark specimen-mark--tl" aria-hidden="true" />
        <span className="specimen-mark specimen-mark--tr" aria-hidden="true" />
        <span className="specimen-mark specimen-mark--bl" aria-hidden="true" />
        <span className="specimen-mark specimen-mark--br" aria-hidden="true" />
      </div>
      {caption ? <figcaption className="specimen-caption">{caption}</figcaption> : null}
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* ScoreDial — graduated 240° instrument arc that sweeps to the score  */
/* ------------------------------------------------------------------ */
export function ScoreDial({ score, status, size = 190, animate = true, pending = false }) {
  const meta = VERDICT[status] || VERDICT.partial_deviation;
  // A pending (held-for-review) score renders muted — it is a proposal,
  // not a verdict, and does not count toward adherence yet.
  const strokeColor = pending ? "var(--rule-strong)" : meta.color;
  const [shown, setShown] = useState(animate && !prefersReducedMotion() ? 0 : score);
  const raf = useRef(null);

  useEffect(() => {
    if (!animate || prefersReducedMotion()) { setShown(score); return; }
    const t0 = performance.now();
    const dur = 700;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setShown(Math.round(score * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [score, animate]);

  // 240° arc, opening at the bottom: from 150° to 390°
  const cx = size / 2, cy = size / 2;
  const rTrack = size / 2 - 24; // leave room for graduations + labels inside the SVG
  const startDeg = 150, sweepDeg = 240;
  const toXY = (deg, r) => {
    const rad = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const arcPath = (fromDeg, toDeg, r) => {
    const [x1, y1] = toXY(fromDeg, r);
    const [x2, y2] = toXY(toDeg, r);
    const large = toDeg - fromDeg > 180 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };

  // graduations: minor every 5, major every 25 (labeled)
  const ticks = [];
  for (let v = 0; v <= 100; v += 5) {
    const deg = startDeg + (v / 100) * sweepDeg;
    const major = v % 25 === 0;
    const [x1, y1] = toXY(deg, rTrack + (major ? 9 : 6));
    const [x2, y2] = toXY(deg, rTrack + 2);
    ticks.push(
      <line key={v} x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={major ? "var(--ink-2)" : "var(--rule-strong)"} strokeWidth={major ? 1.4 : 1} />
    );
    if (major) {
      const [lx, ly] = toXY(deg, rTrack + 16);
      ticks.push(
        <text key={`l${v}`} x={lx} y={ly + 3} textAnchor="middle" fontSize="8.5"
          fill="var(--ink-muted)" style={{ fontFamily: "var(--font-mono)" }}>{v}</text>
      );
    }
  }

  const progressDeg = startDeg + (shown / 100) * sweepDeg;
  const [dotX, dotY] = toXY(progressDeg, rTrack - 3);

  return (
    <div role="img"
      aria-label={pending
        ? `Proposed score ${score} out of 100 — held for reviewer confirmation`
        : `Adherence score ${score} out of 100 — ${meta.label}`}
      style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size}>
        {/* track */}
        <path d={arcPath(startDeg, startDeg + sweepDeg, rTrack - 3)} fill="none"
          stroke="var(--rule)" strokeWidth="5" strokeLinecap="round" />
        {/* progress */}
        {shown > 0 ? (
          <path d={arcPath(startDeg, progressDeg, rTrack - 3)} fill="none"
            stroke={strokeColor} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={pending ? "1.5 6" : "none"} />
        ) : null}
        {/* graduations */}
        {ticks}
        {/* needle dot with paper ring */}
        <circle cx={dotX} cy={dotY} r="4.5" fill={strokeColor} stroke="var(--surface)" strokeWidth="2" />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", pointerEvents: "none",
      }}>
        <div className="dial-value">{shown}</div>
        <div className="dial-denom">/ 100</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* VerdictStamp — the stamped match status                             */
/* ------------------------------------------------------------------ */
export function VerdictStamp({ status, pending = false }) {
  if (pending) {
    return <div className="stamp stamp--pending">Held for review</div>;
  }
  const meta = VERDICT[status] || VERDICT.partial_deviation;
  const label = STATUS_META[status]?.label || status;
  return <div className={`stamp ${meta.stamp}`}>{label}</div>;
}

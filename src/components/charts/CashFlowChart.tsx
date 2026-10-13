"use client";

import { useState } from "react";
import type { CashFlowYear } from "@/lib/calc/financial";
import { money, moneyCompact } from "@/lib/format";

/**
 * Cumulative cash position by year: a polarity encoding (below / above break-even) with two
 * diverging hues, one zero baseline, per-bar hover tooltip, legend and a table fallback.
 */
export function CashFlowChart({ flows, capex, currency = "NGN" }: { flows: CashFlowYear[]; capex: number; currency?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const series = [{ year: 0, cumulative: -capex, net: -capex }, ...flows.map((f) => ({ year: f.year, cumulative: f.cumulative, net: f.net }))];
  const W = 760;
  const H = 300;
  const m = { l: 64, r: 16, t: 16, b: 34 };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;
  const minV = Math.min(0, ...series.map((s) => s.cumulative));
  const maxV = Math.max(0, ...series.map((s) => s.cumulative));
  const span = maxV - minV || 1;
  const y = (v: number) => m.t + ((maxV - v) / span) * ph;
  const band = pw / series.length;
  const bw = Math.min(24, band * 0.7);
  const ticks = niceTicks(minV, maxV, 5);

  const bar = (x: number, v: number) => {
    const y0 = y(0);
    const y1 = y(v);
    const h = Math.abs(y1 - y0);
    if (h < 1) return `M${x},${y0} h${bw} v-1 h-${bw} z`;
    const r = Math.min(4, h, bw / 2);
    // Rounded data end, square at the baseline
    return v >= 0
      ? `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + bw - r} Q${x + bw},${y1} ${x + bw},${y1 + r} V${y0} Z`
      : `M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + bw - r} Q${x + bw},${y1} ${x + bw},${y1 - r} V${y0} Z`;
  };

  const h = hover !== null ? series[hover] : null;
  return (
    <figure>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--series-2)" }} /> Below break-even
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--series-1)" }} /> Above break-even
        </span>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Cumulative cash position by year">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
              <text x={m.l - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="var(--muted)">
                {moneyCompact(t, currency)}
              </text>
            </g>
          ))}
          <line x1={m.l} x2={W - m.r} y1={y(0)} y2={y(0)} stroke="var(--muted)" strokeWidth={1} />
          {series.map((s, i) => {
            const x = m.l + i * band + (band - bw) / 2;
            return (
              <g key={s.year} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={m.l + i * band} y={m.t} width={band} height={ph} fill="transparent" />
                <path d={bar(x, s.cumulative)} fill={s.cumulative >= 0 ? "var(--series-1)" : "var(--series-2)"} opacity={hover === null || hover === i ? 1 : 0.5} />
                {(s.year % 5 === 0 || i === series.length - 1) && (
                  <text x={x + bw / 2} y={H - m.b + 16} textAnchor="middle" fontSize="11" fill="var(--muted)">
                    {s.year}
                  </text>
                )}
              </g>
            );
          })}
          <text x={W - m.r} y={H - 4} textAnchor="end" fontSize="11" fill="var(--muted)">
            Year
          </text>
        </svg>
        {h && hover !== null && (
          <div className="pointer-events-none absolute top-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-sm" style={{ left: `${Math.min(70, ((m.l + hover * band) / W) * 100)}%` }}>
            <div className="font-semibold">Year {h.year}</div>
            <div className="num">Cumulative: {money(h.cumulative, currency)}</div>
            <div className="num text-muted">Net cash flow: {money(h.net, currency)}</div>
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>Cumulative cash position by year</caption>
        <tbody>
          {series.map((s) => (
            <tr key={s.year}>
              <th>Year {s.year}</th>
              <td>{money(s.cumulative, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function niceTicks(min: number, max: number, count: number) {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => span / s <= count) ?? mag * 10;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v));
  return out;
}

"use client";

import { useState } from "react";
import { MONTH_LABELS } from "@/lib/climate";

/**
 * Single-series monthly column chart (change over the year). One hue; the design month and the
 * reference line are labelled directly; per-column hover tooltip; table fallback for screen readers.
 */
export function MonthlyChart({ values, unit, title, highlight, reference }: { values: number[]; unit: string; title: string; highlight?: number; reference?: { value: number; label: string } }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 220;
  const m = { l: 36, r: reference ? 78 : 12, t: 18, b: 26 };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;
  const max = Math.ceil(Math.max(1, ...values, reference?.value ?? 0));
  const y = (v: number) => m.t + ph - (v / max) * ph;
  const band = pw / 12;
  const bw = Math.min(24, band * 0.6);
  const ticks = Array.from({ length: max + 1 }, (_, i) => i).filter((t) => max <= 6 || t % 2 === 0);

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
            <text x={m.l - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="var(--muted)">
              {t}
            </text>
          </g>
        ))}
        {values.map((v, i) => {
          const x = m.l + i * band + (band - bw) / 2;
          const top = y(v);
          const h = m.t + ph - top;
          const r = Math.min(4, h, bw / 2);
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={m.l + i * band} y={m.t} width={band} height={ph} fill="transparent" />
              <path
                d={`M${x},${m.t + ph} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${m.t + ph} Z`}
                fill="var(--series-1)"
                opacity={highlight === undefined || highlight === i || hover === i ? 1 : 0.55}
              />
              {highlight === i && (
                <text x={x + bw / 2} y={top - 5} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--text)">
                  {v.toFixed(2)}
                </text>
              )}
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
                {MONTH_LABELS[i]}
              </text>
            </g>
          );
        })}
        {reference && (
          <g>
            <line x1={m.l} x2={W - m.r} y1={y(reference.value)} y2={y(reference.value)} stroke="var(--text)" strokeWidth={1} strokeDasharray="4 3" />
            <text x={W - m.r + 6} y={y(reference.value)} dominantBaseline="middle" fontSize="11" fill="var(--text)">
              {reference.label}
            </text>
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-0 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-sm" style={{ left: `${Math.min(80, ((m.l + hover * band) / W) * 100)}%` }}>
          <span className="font-semibold">{MONTH_LABELS[hover]}</span>: {values[hover].toFixed(2)} {unit}
        </div>
      )}
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {values.map((v, i) => (
            <tr key={i}>
              <th>{MONTH_LABELS[i]}</th>
              <td>
                {v} {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

"use client";

import { useState } from "react";

/**
 * Single-series horizontal bar chart (magnitude by category). One hue, value labels at the
 * bar tips, a hover tooltip per bar, and a table fallback via aria.
 */
export function HBarChart({ data, unit, format = (v) => v.toFixed(0), title }: { data: { label: string; value: number }[]; unit: string; format?: (v: number) => string; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((a, d) => a + d.value, 0);
  const rowH = 30;
  const labelW = 120;
  const valueW = 92;
  const W = 560;
  const plotW = W - labelW - valueW;
  const H = data.length * rowH + 8;

  if (!data.length) return <p className="text-sm text-muted">No data yet.</p>;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title}>
        <title>{title}</title>
        {data.map((d, i) => {
          const y = i * rowH + 4;
          const w = Math.max(2, (d.value / max) * plotW);
          const active = hover === i;
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={0} y={y} width={W} height={rowH} fill="transparent" />
              <text x={labelW - 8} y={y + rowH / 2} textAnchor="end" dominantBaseline="middle" fontSize="12" fill="var(--muted)">
                {d.label}
              </text>
              {/* 4px rounded data end, square at the baseline */}
              <path d={`M${labelW},${y + 5} h${Math.max(0, w - 4)} a4,4 0 0 1 4,4 v${rowH - 18} a4,4 0 0 1 -4,4 h-${Math.max(0, w - 4)} z`} fill="var(--series-1)" opacity={hover === null || active ? 1 : 0.55} />
              <text x={labelW + w + 6} y={y + rowH / 2} dominantBaseline="middle" fontSize="12" fill="var(--text)" className="num">
                {format(d.value)} {unit}
              </text>
              {active && (
                <g pointerEvents="none">
                  <rect x={labelW + 8} y={y - 2} width={170} height={rowH - 2} rx={6} fill="var(--surface)" stroke="var(--line)" />
                  <text x={labelW + 16} y={y + rowH / 2 - 2} dominantBaseline="middle" fontSize="11" fill="var(--text)">
                    {d.label}: {format(d.value)} {unit} ({total > 0 ? ((d.value / total) * 100).toFixed(0) : 0} %)
                  </text>
                </g>
              )}
            </g>
          );
        })}
        <line x1={labelW} x2={labelW} y1={0} y2={H} stroke="var(--grid)" />
      </svg>
      <div className="sr-only">
        <table>
          <caption>{title}</caption>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <th>{d.label}</th>
                <td>
                  {format(d.value)} {unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

"use client";

import { useState } from "react";

export interface TrafficDay {
  day: string;
  visitors: number;
  users: number;
  views: number;
  signups: number;
}

const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });

/** Daily visitors with the signed-in share overlaid; hover a day for its numbers. */
export function TrafficChart({ series }: { series: TrafficDay[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 960;
  const H = 240;
  const m = { l: 34, r: 8, t: 12, b: 24 };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;
  const raw = Math.max(1, ...series.map((s) => s.visitors));
  const step = raw <= 5 ? 1 : Math.ceil(raw / 4 / 5) * 5;
  const max = Math.ceil(raw / step) * step;
  const y = (v: number) => m.t + ph - (v / max) * ph;
  const band = pw / series.length;
  const bw = Math.min(22, Math.max(2, band * 0.7));
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step);
  const labelEvery = Math.ceil(series.length / 8);
  const h = hover === null ? null : series[hover];

  return (
    <figure className="relative max-w-[1000px]">
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--series-1)" }} /> Visitors (unique devices)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--accent)" }} /> Signed-in users
        </span>
      </div>
      {/* Keeps labels readable on phones: the chart scrolls sideways instead of shrinking. */}
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[640px]" role="img" aria-label="Daily visitors and signed-in users" onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
              <text x={m.l - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="var(--muted)">
                {t}
              </text>
            </g>
          ))}
          {series.map((s, i) => {
            const x = m.l + i * band + (band - bw) / 2;
            return (
              <g key={s.day} onMouseEnter={() => setHover(i)} opacity={hover === null || hover === i ? 1 : 0.55}>
                <rect x={m.l + i * band} y={m.t} width={band} height={ph} fill="transparent" />
                {s.visitors > 0 && <rect x={x} y={y(s.visitors)} width={bw} height={y(0) - y(s.visitors)} rx={1.5} fill="var(--series-1)" />}
                {s.users > 0 && <rect x={x + bw * 0.2} y={y(s.users)} width={bw * 0.6} height={y(0) - y(s.users)} rx={1.5} fill="var(--accent)" />}
                {i % labelEvery === 0 && (
                  <text x={m.l + i * band + band / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">
                    {fmtDay(s.day)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {h && (
        <div className="pointer-events-none absolute top-6 right-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md">
          <div className="font-semibold">{fmtDay(h.day)}</div>
          <div>
            {h.visitors} visitors · {h.users} signed in
          </div>
          <div className="text-muted">
            {h.views} page views · {h.signups} sign-ups
          </div>
        </div>
      )}
      {/* A table can't shrink to the 1px sr-only box, so the wrapper is the hidden element. */}
      <div className="sr-only">
        <table>
          <caption>Daily visitors</caption>
          <thead>
            <tr>
              <th>Day</th>
              <th>Visitors</th>
              <th>Signed-in users</th>
              <th>Page views</th>
              <th>Sign-ups</th>
            </tr>
          </thead>
          <tbody>
            {series.map((s) => (
              <tr key={s.day}>
                <td>{s.day}</td>
                <td>{s.visitors}</td>
                <td>{s.users}</td>
                <td>{s.views}</td>
                <td>{s.signups}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

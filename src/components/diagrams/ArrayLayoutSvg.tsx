"use client";

import { forwardRef } from "react";
import type { LayoutResult } from "@/lib/calc/site";
import type { Assessment, LayoutSettings } from "@/lib/schemas";

/** Categorical slots in fixed order; string labels carry identity, so colour is never the only cue. */
const STRING_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const DARK_TEXT = new Set([2, 3, 4]); // aqua, yellow, magenta need dark labels

export const ArrayLayoutSvg = forwardRef<SVGSVGElement, { layout: LayoutResult; assessment: Assessment; settings: LayoutSettings; title?: string }>(function ArrayLayoutSvg({ layout, assessment, settings, title }, ref) {
  const W = 860;
  const pad = 50;
  const scale = (W - pad * 2) / assessment.roofLengthM;
  const roofH = assessment.roofWidthM * scale;
  const H = roofH + pad * 2 + 30;
  const sx = (m: number) => pad + m * scale;
  const sy = (m: number) => pad + m * scale;
  const strings = new Set(layout.placed.map((p) => p.string)).size;

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title ?? "PV array roof layout"} fontFamily="ui-sans-serif, system-ui, sans-serif">
      <rect x={0} y={0} width={W} height={H} fill="var(--surface)" />
      {/* Roof plane */}
      <rect x={sx(0)} y={sy(0)} width={assessment.roofLengthM * scale} height={roofH} fill="var(--surface-2)" stroke="var(--muted)" strokeWidth={1.5} />
      {/* Setback (fire / maintenance clearance) */}
      <rect x={sx(settings.setbackM)} y={sy(settings.setbackM)} width={Math.max(0, (assessment.roofLengthM - 2 * settings.setbackM) * scale)} height={Math.max(0, (assessment.roofWidthM - 2 * settings.setbackM) * scale)} fill="none" stroke="var(--bad)" strokeDasharray="6 4" strokeWidth={1} />
      <text x={sx(0)} y={sy(0) - 10} fontSize="12" fill="var(--muted)">
        Ridge ↑
      </text>
      <text x={sx(0)} y={sy(assessment.roofWidthM) + 18} fontSize="12" fill="var(--muted)">
        Eave · facing {assessment.roofAzimuthDeg}° · pitch {assessment.roofPitchDeg}°
      </text>
      {/* Dimensions */}
      <text x={W / 2} y={sy(assessment.roofWidthM) + 36} textAnchor="middle" fontSize="12" fill="var(--text)">
        {assessment.roofLengthM.toFixed(2)} m
      </text>
      <text x={pad - 12} y={sy(assessment.roofWidthM / 2)} textAnchor="middle" fontSize="12" fill="var(--text)" transform={`rotate(-90 ${pad - 12} ${sy(assessment.roofWidthM / 2)})`}>
        {assessment.roofWidthM.toFixed(2)} m
      </text>
      {/* Rails: two per row */}
      {layout.rowLengths.map((len, r) => {
        const y0 = settings.setbackM + r * (layout.moduleH + settings.rowGapM);
        return [0.25, 0.75].map((f) => <line key={`${r}-${f}`} x1={sx(settings.setbackM) - 4} x2={sx(settings.setbackM + len) + 4} y1={sy(y0 + layout.moduleH * f)} y2={sy(y0 + layout.moduleH * f)} stroke="var(--muted)" strokeWidth={2} />);
      })}
      {/* Modules */}
      {layout.placed.map((p, i) => {
        const slot = p.string % STRING_COLORS.length;
        return (
          <g key={i}>
            <rect x={sx(p.x)} y={sy(p.y)} width={p.w * scale} height={p.h * scale} rx={2} fill={STRING_COLORS[slot]} fillOpacity={0.9} stroke="var(--surface)" strokeWidth={2} />
            <text x={sx(p.x + p.w / 2)} y={sy(p.y + p.h / 2)} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(12, p.w * scale * 0.28)} fontWeight="600" fill={DARK_TEXT.has(slot) ? "#111" : "#fff"}>
              S{p.string + 1}
            </text>
          </g>
        );
      })}
      {/* Legend */}
      <g transform={`translate(${W - pad - 190}, ${sy(assessment.roofWidthM) + 8})`}>
        <rect width={12} height={12} y={-1} fill="none" stroke="var(--bad)" strokeDasharray="4 3" />
        <text x={18} y={9} fontSize="11" fill="var(--muted)">
          {settings.setbackM} m setback · {strings} string{strings === 1 ? "" : "s"}
        </text>
      </g>
    </svg>
  );
});

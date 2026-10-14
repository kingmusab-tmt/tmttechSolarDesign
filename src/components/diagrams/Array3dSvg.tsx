"use client";

import { forwardRef, type ReactNode } from "react";
import type { LayoutResult, MountType } from "@/lib/calc/site";
import type { Assessment, LayoutSettings } from "@/lib/schemas";
import { STRING_COLORS, DARK_TEXT } from "./ArrayLayoutSvg";

type V3 = [number, number, number]; // X along the eave (m), Y away from the viewer (m), Z up (m)

const WALL_H = 3; // single-storey eave height
const RAIL_LIFT = 0.08; // modules sit on rails just above the roof sheet

/** Axonometric view from the front-right, above: the equator-facing side faces the viewer. */
const raw = ([X, Y, Z]: V3): [number, number] => [X * 0.94 + Y * 0.52, X * 0.16 - Y * 0.36 - Z * 0.92];

interface Poly {
  pts: V3[];
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

const MOUNT_LABEL: Record<MountType, string> = { flat: "Flat roof", ground: "Ground mount", gable: "Gable roof", shed: "Shed (mono-pitch) roof" };

/** 3D view of the array on a flat roof, ground mount, gable roof or shed roof. */
export const Array3dSvg = forwardRef<SVGSVGElement, { layout: LayoutResult; assessment: Assessment; settings: LayoutSettings; mount: MountType; tiltDeg: number; minSunAltitudeDeg: number; azimuthDeg: number }>(function Array3dSvg(
  { layout, assessment, settings, mount, tiltDeg, minSunAltitudeDeg, azimuthDeg },
  ref,
) {
  const L = assessment.roofLengthM;
  const D = assessment.roofWidthM; // slope length (pitched) or horizontal depth (flat / ground)
  const pitch = (Math.max(0, Math.min(60, assessment.roofPitchDeg)) * Math.PI) / 180;
  const racked = mount === "flat" || mount === "ground";
  const beta = (Math.max(5, Math.min(60, tiltDeg)) * Math.PI) / 180;
  const h = layout.moduleH;

  const back: Poly[] = []; // building, ground and roof
  const front: { depth: number; node: (P: (v: V3) => string, pt: (v: V3) => [number, number]) => ReactNode }[] = [];
  const dims: { at: V3; text: string; anchor?: "start" | "middle" | "end"; dy?: number }[] = [];

  /* ---------- building / ground ---------- */
  let surface: (u: number, v: number) => V3; // point on the PV plane (u along eave, v up the slope from the eave)
  if (mount === "ground") {
    back.push({ pts: [[-1.2, -1.5, 0], [L + 1.2, -1.5, 0], [L + 1.2, D + 1.5, 0], [-1.2, D + 1.5, 0]], fill: "var(--ar-ground)", stroke: "var(--ar-ground-edge)" });
    surface = (u, v) => [u, v, 0];
  } else if (mount === "flat") {
    const Z = WALL_H;
    back.push({ pts: [[L, 0, 0], [L, D, 0], [L, D, Z], [L, 0, Z]], fill: "var(--ar-wall-side)", stroke: "var(--ar-edge)" });
    back.push({ pts: [[0, 0, 0], [L, 0, 0], [L, 0, Z], [0, 0, Z]], fill: "var(--ar-wall)", stroke: "var(--ar-edge)" });
    back.push({ pts: [[0, 0, Z], [L, 0, Z], [L, D, Z], [0, D, Z]], fill: "var(--ar-roof)", stroke: "var(--ar-edge)" });
    // parapet
    const P = 0.35;
    back.push({ pts: [[L, 0, Z], [L, D, Z], [L, D, Z + P], [L, 0, Z + P]], fill: "var(--ar-wall-side)", stroke: "var(--ar-edge)", opacity: 0.9 });
    back.push({ pts: [[0, 0, Z], [L, 0, Z], [L, 0, Z + P], [0, 0, Z + P]], fill: "var(--ar-wall)", stroke: "var(--ar-edge)", opacity: 0.55 });
    surface = (u, v) => [u, v, Z];
  } else {
    const c = Math.cos(pitch);
    const s = Math.sin(pitch);
    const run = D * c;
    const ridgeZ = WALL_H + D * s;
    if (mount === "gable") {
      // rear plane, side wall with gable end, front wall, then the PV (front) plane
      back.push({ pts: [[0, run, ridgeZ], [L, run, ridgeZ], [L, 2 * run, WALL_H], [0, 2 * run, WALL_H]], fill: "var(--ar-roof-dark)", stroke: "var(--ar-edge)" });
      back.push({ pts: [[L, 0, 0], [L, 2 * run, 0], [L, 2 * run, WALL_H], [L, run, ridgeZ], [L, 0, WALL_H]], fill: "var(--ar-wall-side)", stroke: "var(--ar-edge)" });
    } else {
      back.push({ pts: [[L, 0, 0], [L, run, 0], [L, run, ridgeZ], [L, 0, WALL_H]], fill: "var(--ar-wall-side)", stroke: "var(--ar-edge)" });
    }
    back.push({ pts: [[0, 0, 0], [L, 0, 0], [L, 0, WALL_H], [0, 0, WALL_H]], fill: "var(--ar-wall)", stroke: "var(--ar-edge)" });
    back.push({ pts: [[0, 0, WALL_H], [L, 0, WALL_H], [L, run, ridgeZ], [0, run, ridgeZ]], fill: "var(--ar-roof)", stroke: "var(--ar-edge)" });
    surface = (u, v) => [u, v * c, WALL_H + v * s + RAIL_LIFT];
    dims.push({ at: [L + 0.2, run / 2, WALL_H + (D * s) / 2], text: `${D.toFixed(2)} m slope · ${assessment.roofPitchDeg}°`, anchor: "start" });
  }
  dims.push({ at: [L / 2, 0, 0], text: `${L.toFixed(2)} m${mount === "ground" ? " × " + D.toFixed(2) + " m area" : ""}`, dy: 16 });

  /* ---------- setback outline on the mounting surface ---------- */
  const sb = settings.setbackM;
  const setback: V3[] = racked ? [surface(sb, sb), surface(L - sb, sb), surface(L - sb, D - sb), surface(sb, D - sb)] : [surface(sb, sb), surface(L - sb, sb), surface(L - sb, D - sb), surface(sb, D - sb)];

  /* ---------- modules ---------- */
  const rowsUsed = Math.max(1, layout.rowsUsed);
  // Racks: rows tilted at beta, spaced so the front row does not shade the next at the lowest noon sun.
  const alt = (Math.max(10, minSunAltitudeDeg) * Math.PI) / 180;
  const shadeGap = (h * Math.sin(beta)) / Math.tan(alt);
  const rowPitch = h * Math.cos(beta) + Math.max(settings.rowGapM, shadeGap);
  const rackDepth = 2 * sb + (rowsUsed - 1) * rowPitch + h * Math.cos(beta);
  const legBase = mount === "ground" ? 0.5 : 0.25;

  const moduleCorners = (p: LayoutResult["placed"][number]): V3[] => {
    if (racked) {
      const y0 = sb + p.row * rowPitch;
      const b = surface(0, 0)[2] + legBase;
      return [
        [p.x, y0, b],
        [p.x + p.w, y0, b],
        [p.x + p.w, y0 + h * Math.cos(beta), b + h * Math.sin(beta)],
        [p.x, y0 + h * Math.cos(beta), b + h * Math.sin(beta)],
      ];
    }
    // plan y runs down from the ridge; v runs up from the eave
    const v1 = D - (p.y + p.h);
    const v2 = D - p.y;
    return [surface(p.x, v1), surface(p.x + p.w, v1), surface(p.x + p.w, v2), surface(p.x, v2)];
  };

  if (racked) {
    // frame legs per row: front and rear posts about every 2 m
    const rows = new Map<number, { x0: number; x1: number }>();
    for (const p of layout.placed) {
      const r = rows.get(p.row) ?? { x0: Infinity, x1: -Infinity };
      rows.set(p.row, { x0: Math.min(r.x0, p.x), x1: Math.max(r.x1, p.x + p.w) });
    }
    for (const [row, { x0, x1 }] of rows) {
      const y0 = sb + row * rowPitch;
      const yb = y0 + h * Math.cos(beta);
      const z0 = surface(0, 0)[2];
      const top = z0 + legBase;
      const n = Math.max(2, Math.ceil((x1 - x0) / 2) + 1);
      const xs = Array.from({ length: n }, (_, i) => x0 + 0.15 + ((x1 - x0 - 0.3) * i) / (n - 1));
      front.push({
        depth: y0 + 0.01,
        node: (P) => (
          <g key={`legs${row}`} stroke="var(--ar-frame)" strokeWidth={2} strokeLinecap="round">
            {xs.map((x) => (
              <g key={x}>
                <polyline points={P([x, yb, z0]) + " " + P([x, yb, top + h * Math.sin(beta)])} fill="none" />
                <polyline points={P([x, y0, z0]) + " " + P([x, y0, top])} fill="none" />
                <polyline points={P([x, y0, z0]) + " " + P([x, yb, z0])} fill="none" strokeWidth={1.2} opacity={0.6} />
              </g>
            ))}
          </g>
        ),
      });
    }
  } else {
    // rails under each used row
    const rows = new Map<number, { x0: number; x1: number; y: number; ph: number }>();
    for (const p of layout.placed) {
      const r = rows.get(p.row) ?? { x0: Infinity, x1: -Infinity, y: p.y, ph: p.h };
      rows.set(p.row, { ...r, x0: Math.min(r.x0, p.x), x1: Math.max(r.x1, p.x + p.w) });
    }
    for (const [row, r] of rows) {
      for (const f of [0.25, 0.75]) {
        const v = D - (r.y + r.ph * f);
        front.push({
          depth: 1e6, // under every module
          node: (P) => <polyline key={`rail${row}${f}`} points={P(surface(r.x0 - 0.1, v)) + " " + P(surface(r.x1 + 0.1, v))} fill="none" stroke="var(--ar-frame)" strokeWidth={2} />,
        });
      }
    }
  }

  layout.placed.forEach((p, i) => {
    const c = moduleCorners(p);
    const slot = p.string % STRING_COLORS.length;
    const lerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const depth = racked ? sb + p.row * rowPitch : D - p.y; // larger = further from the viewer
    front.push({
      depth: depth - 0.001 * p.x,
      node: (P, pt) => {
        const centre = lerp(lerp(c[0], c[2], 0.5), lerp(c[1], c[3], 0.5), 0.5);
        const [cx, cy] = pt(centre);
        const widthPx = Math.hypot(pt(c[1])[0] - pt(c[0])[0], pt(c[1])[1] - pt(c[0])[1]);
        return (
          <g key={`m${i}`}>
            <polygon points={c.map(P).join(" ")} fill={STRING_COLORS[slot]} stroke="var(--ar-module-frame)" strokeWidth={1.2} strokeLinejoin="round" />
            {/* cell grid */}
            {[1 / 3, 2 / 3].map((t) => (
              <polyline key={`v${t}`} points={P(lerp(c[0], c[3], t)) + " " + P(lerp(c[1], c[2], t))} fill="none" stroke="#fff" strokeOpacity={0.28} strokeWidth={0.8} />
            ))}
            <polyline points={P(lerp(c[0], c[1], 0.5)) + " " + P(lerp(c[3], c[2], 0.5))} fill="none" stroke="#fff" strokeOpacity={0.28} strokeWidth={0.8} />
            <polygon points={c.map(P).join(" ")} fill="url(#ar-sheen)" />
            {widthPx > 16 && (
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(7, Math.min(11, widthPx * 0.32))} fontWeight="700" fill={DARK_TEXT.has(slot) ? "#111" : "#fff"}>
                S{p.string + 1}
              </text>
            )}
          </g>
        );
      },
    });
  });
  // back to front: furthest first
  front.sort((a, b) => b.depth - a.depth);

  /* ---------- fit to the canvas ---------- */
  const all = [...back.flatMap((b) => b.pts), ...layout.placed.flatMap(moduleCorners), ...setback, ...dims.map((d) => d.at)].map(raw);
  const minX = Math.min(...all.map((p) => p[0]));
  const maxX = Math.max(...all.map((p) => p[0]));
  const minY = Math.min(...all.map((p) => p[1]));
  const maxY = Math.max(...all.map((p) => p[1]));
  const W = 860;
  const pad = 40;
  const scale = (W - 2 * pad - 150) / Math.max(1, maxX - minX); // room on the right for the slope label
  const H = Math.round((maxY - minY) * scale + 2 * pad + 50);
  const pt = (v: V3): [number, number] => {
    const [x, y] = raw(v);
    return [pad + (x - minX) * scale, pad + (y - minY) * scale];
  };
  const P = (v: V3) => pt(v).map((n) => n.toFixed(1)).join(",");

  const strings = new Set(layout.placed.map((p) => p.string)).size;
  const tiltShown = Math.round((beta * 180) / Math.PI);
  const depthShort = racked && rackDepth > D + 0.01;

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`3D view of the PV array: ${MOUNT_LABEL[mount]}`} fontFamily="ui-sans-serif, system-ui, sans-serif">
      <defs>
        <linearGradient id="ar-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0.32} />
          <stop offset="0.45" stopColor="#fff" stopOpacity={0.06} />
          <stop offset="1" stopColor="#000" stopOpacity={0.12} />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="var(--surface)" />
      {back.map((b, i) => (
        <polygon key={i} points={b.pts.map(P).join(" ")} fill={b.fill} stroke={b.stroke} strokeWidth={b.strokeWidth ?? 1.2} strokeLinejoin="round" opacity={b.opacity} />
      ))}
      <polygon points={setback.map(P).join(" ")} fill="none" stroke="var(--bad)" strokeDasharray="6 4" strokeWidth={1} />
      {front.map((f) => f.node(P, pt))}
      {dims.map((d, i) => {
        const [x, y] = pt(d.at);
        return (
          <text key={i} x={x + (d.anchor === "start" ? 8 : 0)} y={y + (d.dy ?? 0)} textAnchor={d.anchor ?? "middle"} fontSize="12" fill="var(--text)">
            {d.text}
          </text>
        );
      })}
      <g fontSize="11" fill="var(--muted)">
        <text x={pad} y={H - 30}>
          {MOUNT_LABEL[mount]} · array facing {racked ? `${azimuthDeg}° on ${tiltShown}° tilt frames` : `${assessment.roofAzimuthDeg}° at ${assessment.roofPitchDeg}° roof pitch`} · {layout.placed.length} modules in {strings} string{strings === 1 ? "" : "s"}
        </text>
        <text x={pad} y={H - 14}>
          {racked ? `Row pitch ${rowPitch.toFixed(2)} m (shade-free at ${Math.round((alt * 180) / Math.PI)}° winter noon sun) · ` : ""}
          <tspan fill="var(--bad)">- - -</tspan> {settings.setbackM} m setback · not to scale
        </text>
      </g>
      {depthShort && (
        <text x={W - pad} y={pad - 14} textAnchor="end" fontSize="11" fontWeight="600" fill="var(--warn)">
          Tilted rows need {rackDepth.toFixed(1)} m of depth; the area is {D.toFixed(1)} m deep. Reduce rows or enlarge the area.
        </text>
      )}
    </svg>
  );
});

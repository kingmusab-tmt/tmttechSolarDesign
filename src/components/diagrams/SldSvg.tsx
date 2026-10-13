"use client";

import { forwardRef } from "react";
import type { DesignResults } from "@/lib/calc";
import type { ProjectData } from "@/lib/schemas";
import { fmt } from "@/lib/format";

interface Block {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  lines: string[];
  kind: "source" | "protection" | "converter" | "storage" | "load";
}

const KIND_STYLE: Record<Block["kind"], { fill: string; stroke: string }> = {
  source: { fill: "var(--accent-soft)", stroke: "var(--accent)" },
  protection: { fill: "var(--surface)", stroke: "var(--muted)" },
  converter: { fill: "var(--info-soft)", stroke: "var(--info)" },
  storage: { fill: "var(--good-soft)", stroke: "var(--good)" },
  load: { fill: "var(--surface-2)", stroke: "var(--muted)" },
};

type Pt = [number, number];
interface Wire {
  pts: Pt[];
  label?: string;
  labelAt?: Pt;
  kind: "dc" | "ac" | "pe";
}

/** Auto-generated single-line diagram reflecting every rating and cable size in the design. */
export const SldSvg = forwardRef<SVGSVGElement, { project: ProjectData; results: DesignResults }>(function SldSvg({ project, results }, ref) {
  const r = results;
  const hybrid = project.inverter.type === "hybrid";
  const grid = project.site.gridAvailable;
  const seg = (k: string) => r.cables.segments.find((s) => s.key === k);
  const mm = (k: string) => (seg(k) ? `${seg(k)!.sizeMm2} mm²` : "");
  const panel = project.pv.panel;
  const shift = hybrid ? 0 : 250; // standalone adds a charge-controller column
  const W = 1210 + shift;
  const H = 620;
  const EARTH_Y = 530;

  const blocks: Block[] = [
    { id: "pv", x: 20, y: 130, w: 170, h: 110, kind: "source", title: "PV ARRAY", lines: [`${r.strings.series} × ${r.strings.parallel} × ${panel.pmaxW} Wp`, `${fmt(r.strings.arrayW / 1000, 2)} kWp`, `Voc(${project.site.tMin}°C) ${fmt(r.strings.stringVocCold, 0)} V`] },
    { id: "dci", x: 240, y: 150, w: 130, h: 70, kind: "protection", title: "DC ISOLATOR", lines: [`${r.cables.dcIsolatorA} A / ${r.cables.dcIsolatorV} V DC`, r.cables.stringFuseA ? `+ ${r.cables.stringFuseA} A gPV fuses` : ""] },
    { id: "dcspd", x: 240, y: 280, w: 130, h: 50, kind: "protection", title: "DC SPD TYPE II", lines: [`Ucpv ${r.cables.dcSpdUcpv} V`] },
  ];
  const wires: Wire[] = [
    { pts: [[190, 185], [240, 185]], kind: "dc", label: `2×${mm("pv_string")}`, labelAt: [215, 177] },
    { pts: [[305, 220], [305, 280]], kind: "dc" },
    { pts: [[305, 330], [305, EARTH_Y]], kind: "pe" },
    { pts: [[105, 240], [105, EARTH_Y]], kind: "pe", label: `${r.cables.earthing.bondingMm2} mm² bond`, labelAt: [110, 300] },
  ];

  const invX = hybrid ? 430 : 680;
  const inverter: Block = {
    id: "inv",
    x: invX,
    y: 120,
    w: 190,
    h: 130,
    kind: "converter",
    title: hybrid ? "HYBRID INVERTER" : "INVERTER",
    lines: [`${fmt(r.inverter.ratedPowerW / 1000, 1)} kW · ${r.inverter.systemVoltage} V DC`, `Surge ${fmt(r.inverter.surgePowerW / 1000, 1)} kW`, hybrid ? `MPPT ${r.inverter.spec.mpptMinV}–${r.inverter.spec.mpptMaxV} V` : "Pure sine 230 V AC", r.inverter.isSelected ? r.inverter.spec.model : ""],
  };
  blocks.push(inverter);

  if (hybrid) {
    blocks.push(
      { id: "bfuse", x: 455, y: 300, w: 140, h: 50, kind: "protection", title: "BATTERY FUSE", lines: [`${r.cables.batteryFuseA} A + isolator`] },
      { id: "bat", x: 440, y: 390, w: 170, h: 80, kind: "storage", title: "BATTERY BANK", lines: [`${r.battery.seriesCount}S${r.battery.parallelCount}P · ${fmt(r.battery.bankVoltage, 1)} V`, `${fmt(r.battery.bankAh)} Ah · ${fmt(r.battery.bankKWh, 1)} kWh`] },
    );
    wires.push(
      { pts: [[370, 185], [430, 185]], kind: "dc", label: `2×${mm("pv_array")}`, labelAt: [400, 177] },
      { pts: [[525, 250], [525, 300]], kind: "dc", label: mm("batt_inv"), labelAt: [532, 280] },
      { pts: [[525, 350], [525, 390]], kind: "dc" },
      { pts: [[430, 240], [415, 240], [415, EARTH_Y]], kind: "pe" },
    );
  } else {
    blocks.push(
      { id: "cc", x: 430, y: 130, w: 170, h: 110, kind: "converter", title: "MPPT CONTROLLER", lines: [`${r.controller.count} × ${r.controller.ratedA} A`, `${r.inverter.systemVoltage} V battery`, `Max PV ${project.controller.maxPvVoltage} V`] },
      { id: "bfuse", x: 445, y: 290, w: 140, h: 50, kind: "protection", title: "DC BREAKER", lines: [`${seg("ctrl_batt")?.protectionA ?? ""} A`] },
      { id: "bat", x: 430, y: 400, w: 170, h: 80, kind: "storage", title: "BATTERY BANK", lines: [`${r.battery.seriesCount}S${r.battery.parallelCount}P · ${fmt(r.battery.bankVoltage, 1)} V`, `${fmt(r.battery.bankAh)} Ah · ${fmt(r.battery.bankKWh, 1)} kWh`] },
      { id: "ifuse", x: 705, y: 290, w: 140, h: 50, kind: "protection", title: "BATTERY FUSE", lines: [`${r.cables.batteryFuseA} A + isolator`] },
    );
    wires.push(
      { pts: [[370, 185], [430, 185]], kind: "dc", label: `2×${mm("pv_array")}`, labelAt: [400, 177] },
      { pts: [[515, 240], [515, 290]], kind: "dc", label: mm("ctrl_batt"), labelAt: [522, 270] },
      { pts: [[515, 340], [515, 400]], kind: "dc" },
      { pts: [[515, 375], [775, 375], [775, 340]], kind: "dc", label: mm("batt_inv"), labelAt: [640, 368] },
      { pts: [[775, 290], [775, 250]], kind: "dc" },
      { pts: [[430, 230], [415, 230], [415, EARTH_Y]], kind: "pe" },
      { pts: [[870, 240], [885, 240], [885, EARTH_Y]], kind: "pe" },
    );
  }

  const acX = 680 + shift;
  blocks.push(
    { id: "acb", x: acX, y: 150, w: 130, h: 70, kind: "protection", title: "AC BREAKER", lines: [`${r.cables.acBreakerA} A DP MCB`] },
    { id: "acspd", x: acX, y: 280, w: 130, h: 50, kind: "protection", title: "AC SPD TYPE II", lines: ["Uc 275 V · 20 kA"] },
    { id: "db", x: acX + 190, y: 130, w: 150, h: 110, kind: "load", title: "DISTRIBUTION BOARD", lines: ["MCBs + 30 mA RCD", `${fmt(r.load.continuousW)} W design load`] },
    { id: "loads", x: acX + 390, y: 150, w: 120, h: 70, kind: "load", title: "LOADS", lines: [`${fmt(r.load.dailyWh / 1000, 1)} kWh/day`] },
  );
  wires.push(
    { pts: [[invX + 190, 185], [acX, 185]], kind: "ac", label: mm("ac_out"), labelAt: [(invX + 190 + acX) / 2, 177] },
    { pts: [[acX + 130, 185], [acX + 190, 185]], kind: "ac" },
    { pts: [[acX + 340, 185], [acX + 390, 185]], kind: "ac" },
    { pts: [[acX + 65, 220], [acX + 65, 280]], kind: "ac" },
    { pts: [[acX + 65, 330], [acX + 65, EARTH_Y]], kind: "pe" },
    { pts: [[acX + 265, 240], [acX + 265, EARTH_Y]], kind: "pe" },
  );

  if (grid) {
    blocks.push(
      { id: "acin", x: acX, y: 20, w: 130, h: 55, kind: "protection", title: "AC INPUT MCB", lines: [`${r.cables.acBreakerA} A${hybrid ? "" : " + changeover"}`] },
      { id: "grid", x: acX + 190, y: 20, w: 150, h: 55, kind: "source", title: "GRID / GENERATOR", lines: ["230 V AC"] },
    );
    wires.push(
      { pts: [[acX + 190, 47], [acX + 130, 47]], kind: "ac", label: mm("ac_in"), labelAt: [acX + 160, 40] },
      { pts: [[acX, 47], [invX + 170, 47], [invX + 170, 120]], kind: "ac" },
    );
  }

  const stroke = (k: Wire["kind"]) => (k === "pe" ? "var(--good)" : k === "dc" ? "var(--bad)" : "var(--text)");

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Single-line diagram" fontFamily="ui-sans-serif, system-ui, sans-serif">
      <rect width={W} height={H} fill="var(--surface)" />
      {wires.map((w, i) => (
        <g key={i}>
          <polyline points={w.pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={stroke(w.kind)} strokeWidth={w.kind === "pe" ? 1.5 : 2} strokeDasharray={w.kind === "pe" ? "6 4" : undefined} />
          {w.label && w.labelAt && (
            <text x={w.labelAt[0]} y={w.labelAt[1]} textAnchor={w.pts[0][0] === w.pts[w.pts.length - 1][0] ? "start" : "middle"} fontSize="10" fill="var(--muted)">
              {w.label}
            </text>
          )}
        </g>
      ))}
      {blocks.map((b) => {
        const st = KIND_STYLE[b.kind];
        return (
          <g key={b.id}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8} fill={st.fill} stroke={st.stroke} strokeWidth={1.5} />
            <text x={b.x + b.w / 2} y={b.y + 18} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text)">
              {b.title}
            </text>
            {b.lines.filter(Boolean).map((l, i) => (
              <text key={i} x={b.x + b.w / 2} y={b.y + 35 + i * 14} textAnchor="middle" fontSize="10" fill="var(--muted)">
                {l}
              </text>
            ))}
          </g>
        );
      })}
      {/* Earth bar and electrode */}
      <line x1={20} x2={W - 70} y1={EARTH_Y} y2={EARTH_Y} stroke="var(--good)" strokeWidth={4} />
      <text x={24} y={EARTH_Y + 18} fontSize="10" fill="var(--muted)">
        MAIN EARTH BAR · {r.cables.earthing.mainEarthMm2} mm² Cu to electrode
      </text>
      <g transform={`translate(${W - 50}, ${EARTH_Y})`}>
        <line x1={-20} x2={0} y1={0} y2={0} stroke="var(--good)" strokeWidth={3} />
        <line x1={0} x2={0} y1={0} y2={14} stroke="var(--good)" strokeWidth={2} />
        <line x1={-12} x2={12} y1={14} y2={14} stroke="var(--good)" strokeWidth={2} />
        <line x1={-8} x2={8} y1={19} y2={19} stroke="var(--good)" strokeWidth={2} />
        <line x1={-4} x2={4} y1={24} y2={24} stroke="var(--good)" strokeWidth={2} />
        <text x={0} y={40} textAnchor="middle" fontSize="10" fill="var(--muted)">
          ≤ {r.cables.earthing.targetOhm} Ω
        </text>
      </g>
      {/* Legend */}
      <g transform={`translate(20, ${H - 12})`} fontSize="10" fill="var(--muted)">
        <line x1={0} x2={24} y1={-3} y2={-3} stroke="var(--bad)" strokeWidth={2} />
        <text x={30} y={0}>DC</text>
        <line x1={60} x2={84} y1={-3} y2={-3} stroke="var(--text)" strokeWidth={2} />
        <text x={90} y={0}>AC (L + N + PE)</text>
        <line x1={180} x2={204} y1={-3} y2={-3} stroke="var(--good)" strokeWidth={1.5} strokeDasharray="6 4" />
        <text x={210} y={0}>Protective earth / bonding</text>
        <text x={W - 40} y={0} textAnchor="end">
          {project.name} · SLD (not to scale)
        </text>
      </g>
    </svg>
  );
});

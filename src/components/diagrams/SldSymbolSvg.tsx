"use client";

import { forwardRef, type ReactNode } from "react";
import type { DesignResults } from "@/lib/calc";
import type { ProjectData } from "@/lib/schemas";
import { APP_NAME } from "@/lib/brand";
import { fmt } from "@/lib/format";

/*
 * IEC 60617-style single-line diagram. Two-terminal devices are drawn vertically around the
 * origin with terminals at (0, -20) and (0, 20) and rotated -90° when they sit on a horizontal run.
 */

const AC = "var(--sld-ac)";
const DC = "var(--sld-dc)";
const PE = "var(--sld-pe)";
const T = 20; // half-length of a two-terminal device

type Pt = [number, number];
const poly = (pts: Pt[]) => pts.map((p) => p.join(",")).join(" ");

function Wire({ pts, color, earth }: { pts: Pt[]; color: string; earth?: boolean }) {
  return <polyline points={poly(pts)} fill="none" stroke={color} strokeWidth={earth ? 1.4 : 2} strokeDasharray={earth ? "6 4" : undefined} strokeLinejoin="round" />;
}

function Dot({ at, color }: { at: Pt; color: string }) {
  return <circle cx={at[0]} cy={at[1]} r={3} fill={color} />;
}

/** Places a vertically drawn symbol at (x, y); `horizontal` turns it onto a left-to-right run. */
function Place({ x, y, horizontal, color, children }: { x: number; y: number; horizontal?: boolean; color: string; children: ReactNode }) {
  return (
    <g transform={`translate(${x},${y})${horizontal ? " rotate(-90)" : ""}`} stroke={color} fill="none" strokeWidth={2} strokeLinecap="round">
      {children}
    </g>
  );
}

/* ---- two-terminal symbols (vertical, terminals at ±T) ---- */

const Fuse = () => (
  <>
    <line x1={0} y1={-T} x2={0} y2={T} />
    <rect x={-5} y={-11} width={10} height={22} fill="var(--surface)" strokeWidth={1.6} />
    <line x1={0} y1={-11} x2={0} y2={11} strokeWidth={1.2} />
  </>
);

/** Switch blade from the lower terminal; `mark` sets the device at the fixed contact. */
function Switch({ mark }: { mark: "breaker" | "isolator" | "switch-disconnector" }) {
  return (
    <>
      <line x1={0} y1={T} x2={0} y2={8} />
      <line x1={0} y1={8} x2={-10} y2={-8} />
      <line x1={0} y1={-9} x2={0} y2={-T} />
      {mark === "breaker" && <path d="M-4,-13 L4,-5 M4,-13 L-4,-5" strokeWidth={1.6} />}
      {mark !== "breaker" && <line x1={-4} y1={-9} x2={4} y2={-9} strokeWidth={1.6} />}
      {mark === "switch-disconnector" && <circle cx={0} cy={-9} r={2} fill="var(--surface)" strokeWidth={1.4} />}
    </>
  );
}

/** Surge arrester (SPD): terminal at top (0, -T), earth side at the bottom (0, T). */
const Spd = () => (
  <>
    <line x1={0} y1={-T} x2={0} y2={-13} />
    <rect x={-7} y={-13} width={14} height={26} fill="var(--surface)" strokeWidth={1.6} />
    <path d="M0,-9 L0,1 M-3.5,-2 L0,4 L3.5,-2" strokeWidth={1.4} />
    <line x1={0} y1={13} x2={0} y2={T} />
  </>
);

/** Protective earth symbol; the connection point is the origin. */
function Earth({ x, y }: { x: number; y: number }) {
  return (
    <g stroke={PE} strokeWidth={2} strokeLinecap="round">
      <line x1={x} y1={y} x2={x} y2={y + 8} />
      <line x1={x - 10} y1={y + 8} x2={x + 10} y2={y + 8} />
      <line x1={x - 6} y1={y + 13} x2={x + 6} y2={y + 13} />
      <line x1={x - 2.5} y1={y + 18} x2={x + 2.5} y2={y + 18} />
    </g>
  );
}

/** Battery of cells, vertical: + terminal at (0, -h/2), − terminal at (0, h/2). */
function BatterySym({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`} stroke={DC} strokeLinecap="round">
      <line x1={0} y1={-26} x2={0} y2={-14} strokeWidth={2} />
      <line x1={-15} y1={-14} x2={15} y2={-14} strokeWidth={2} />
      <line x1={-8} y1={-8} x2={8} y2={-8} strokeWidth={4} />
      <line x1={0} y1={-6} x2={0} y2={4} strokeWidth={1.4} strokeDasharray="2 2.5" />
      <line x1={-15} y1={6} x2={15} y2={6} strokeWidth={2} />
      <line x1={-8} y1={12} x2={8} y2={12} strokeWidth={4} />
      <line x1={0} y1={12} x2={0} y2={26} strokeWidth={2} />
      <text x={-22} y={-14} fontSize="11" fill={DC} stroke="none" textAnchor="middle">
        +
      </text>
    </g>
  );
}

/** DC symbol (solid over dashed) and AC sine, used inside converter boxes. */
const DcMark = ({ x, y, color }: { x: number; y: number; color: string }) => (
  <g stroke={color} strokeWidth={1.8}>
    <line x1={x - 9} y1={y - 3} x2={x + 9} y2={y - 3} />
    <line x1={x - 9} y1={y + 3} x2={x + 9} y2={y + 3} strokeDasharray="4 3" />
  </g>
);
const AcMark = ({ x, y, color }: { x: number; y: number; color: string }) => <path d={`M${x - 10},${y} c3,-8 7,-8 10,0 s7,8 10,0`} stroke={color} strokeWidth={1.8} fill="none" />;

/** Converter: square with a diagonal; `ins`/`outs` marks in the top-left and bottom-right corners. */
function Converter({ cx, cy, size, inMark, outMark, colorIn, colorOut, tag }: { cx: number; cy: number; size: number; inMark: "dc" | "ac"; outMark: "dc" | "ac"; colorIn: string; colorOut: string; tag?: string }) {
  const h = size / 2;
  return (
    <g>
      <rect x={cx - h} y={cy - h} width={size} height={size} fill="var(--surface)" stroke={AC} strokeWidth={2} />
      <line x1={cx - h} y1={cy + h} x2={cx + h} y2={cy - h} stroke={AC} strokeWidth={1.5} />
      {inMark === "dc" ? <DcMark x={cx - h / 2} y={cy - h / 2} color={colorIn} /> : <AcMark x={cx - h / 2} y={cy - h / 2} color={colorIn} />}
      {outMark === "dc" ? <DcMark x={cx + h / 2} y={cy + h / 2} color={colorOut} /> : <AcMark x={cx + h / 2} y={cy + h / 2} color={colorOut} />}
      {tag && (
        <text x={cx - h / 2} y={cy + h / 2 + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill={DC}>
          {tag}
        </text>
      )}
    </g>
  );
}

/** PV generator: module outline with a diagonal and incoming light. */
function PvArray({ cx, cy }: { cx: number; cy: number }) {
  const w = 84;
  const h = 64;
  return (
    <g stroke={DC} fill="none" strokeLinecap="round">
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill="var(--surface)" strokeWidth={2} />
      <line x1={cx - w / 2} y1={cy + h / 2} x2={cx + w / 2} y2={cy - h / 2} strokeWidth={1.5} />
      {/* cell symbol across the diagonal */}
      {/* light arrows */}
      <path d={`M${cx - 34},${cy - 26} l12,10 m0,0 l-5,0 m5,0 l0,-5`} strokeWidth={1.4} />
      <path d={`M${cx - 26},${cy - 30} l12,10 m0,0 l-5,0 m5,0 l0,-5`} strokeWidth={1.4} />
      <text x={cx + w / 2 - 8} y={cy + h / 2 - 6} fontSize="12" fill={DC} stroke="none" textAnchor="middle">
        +
      </text>
    </g>
  );
}

/** Device label: bold name then smaller rating lines. */
function Label({ x, y, title, lines = [], anchor = "middle" }: { x: number; y: number; title: string; lines?: string[]; anchor?: "start" | "middle" | "end" }) {
  return (
    <g textAnchor={anchor}>
      <text x={x} y={y} fontSize="11" fontWeight="700" fill="var(--text)">
        {title}
      </text>
      {lines.filter(Boolean).map((l, i) => (
        <text key={i} x={x} y={y + 13 + i * 12} fontSize="9.5" fill="var(--muted)" fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">
          {l}
        </text>
      ))}
    </g>
  );
}

function CableTag({ x, y, text, anchor = "middle" }: { x: number; y: number; text: string; anchor?: "start" | "middle" | "end" }) {
  if (!text) return null;
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize="9.5" fill="var(--muted)" fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">
      {text}
    </text>
  );
}

/** Single-line diagram drawn with IEC 60617-style electrical symbols. */
export const SldSymbolSvg = forwardRef<SVGSVGElement, { project: ProjectData; results: DesignResults }>(function SldSymbolSvg({ project, results }, ref) {
  const r = results;
  const C = r.cables;
  const hybrid = project.inverter.type === "hybrid";
  const grid = project.site.gridAvailable;
  const panel = project.pv.panel;
  const seg = (k: string) => C.segments.find((s) => s.key === k);
  const mm = (k: string, cores = "") => (seg(k) ? `${cores}${seg(k)!.sizeMm2} mm²` : "");

  const Y = 220; // main power line
  const GY = 80; // grid input line
  const EY = 500; // main earth bar
  const BOX = 96;
  const pe: Pt[][] = [];

  /* ---- DC side ---- */
  const pvX = 92;
  let x = pvX + 42;
  const parts: ReactNode[] = [];
  const add = (n: ReactNode) => parts.push(n);

  add(<PvArray key="pv" cx={pvX} cy={Y} />);
  add(<Label key="pv-l" x={pvX} y={Y - 60} title="PV array" lines={[`${r.strings.series}S × ${r.strings.parallel}P × ${panel.pmaxW} Wp`, `${fmt(r.strings.arrayW / 1000, 2)} kWp · Voc ${fmt(r.strings.stringVocCold, 0)} V @ ${project.site.tMin} °C`]} />);
  pe.push([[pvX, Y + 32], [pvX, EY]]);

  if (C.stringFuseA) {
    const bx = x + 50;
    add(<Wire key="w-str" pts={[[x, Y], [bx, Y]]} color={DC} />);
    add(<CableTag key="c-str" x={(x + bx) / 2} y={Y - 6} text={mm("pv_string", "2×")} />);
    add(
      <g key="cb">
        <rect x={bx} y={Y - 28} width={72} height={56} fill="var(--surface)" stroke={DC} strokeWidth={2} />
        {[bx + 18, bx + 36, bx + 54].map((fx) => (
          <Place key={fx} x={fx} y={Y} color={DC}>
            <g transform="scale(0.8)">
              <Fuse />
            </g>
          </Place>
        ))}
      </g>,
    );
    add(<Label key="cb-l" x={bx + 36} y={Y - 60} title="String fuse box" lines={[`${r.strings.parallel} × ${C.stringFuseA} A gPV`]} />);
    x = bx + 72;
  }

  const isoX = x + 70;
  add(<Wire key="w-arr" pts={[[x, Y], [isoX - T, Y]]} color={DC} />);
  add(<CableTag key="c-arr" x={(x + isoX - T) / 2} y={Y - 6} text={mm(C.stringFuseA ? "pv_array" : "pv_string", "2×")} />);
  add(
    <Place key="iso" x={isoX} y={Y} horizontal color={DC}>
      <Switch mark="switch-disconnector" />
    </Place>,
  );
  add(<Label key="iso-l" x={isoX} y={Y - 60} title="DC switch-disconnector" lines={[`${C.dcIsolatorA} A · ${C.dcIsolatorV} V DC`]} />);

  const spdX = isoX + T + 40;
  const conv1L = spdX + 60; // controller (standalone) or inverter (hybrid)
  add(<Wire key="w-iso" pts={[[isoX + T, Y], [conv1L, Y]]} color={DC} />);
  add(<CableTag key="c-iso" x={spdX + 30} y={Y - 6} text={mm("pv_array", "2×")} />);
  add(<Dot key="d-spd" at={[spdX, Y]} color={DC} />);
  add(<Wire key="w-spd" pts={[[spdX, Y], [spdX, Y + 60 - T]]} color={DC} />);
  add(
    <Place key="spd" x={spdX} y={Y + 60} color={DC}>
      <Spd />
    </Place>,
  );
  add(<Label key="spd-l" x={spdX - 14} y={Y + 56} anchor="end" title="SPD Type 2" lines={[`Ucpv ${C.dcSpdUcpv} V DC`]} />);
  pe.push([[spdX, Y + 60 + T], [spdX, EY]]);

  /* ---- converters and battery ---- */
  const c1x = conv1L + BOX / 2;
  let invX: number;
  if (hybrid) {
    invX = c1x;
    add(<Converter key="inv" cx={invX} cy={Y} size={BOX} inMark="dc" outMark="ac" colorIn={DC} colorOut={AC} tag="PV" />);
    add(<Label key="inv-l" x={invX + 22} y={Y - 98} anchor="end" title="Hybrid inverter" lines={[`${fmt(r.inverter.ratedPowerW / 1000, 1)} kW · ${r.inverter.systemVoltage} V DC / 230 V AC`, `MPPT ${r.inverter.spec.mpptMinV}–${r.inverter.spec.mpptMaxV} V`, r.inverter.isSelected ? r.inverter.spec.model : ""]} />);
    // Battery: inverter → fuse → isolator → battery
    const b = Y + BOX / 2;
    add(<Wire key="w-b1" pts={[[invX, b], [invX, b + 38 - T]]} color={DC} />);
    add(
      <Place key="bf" x={invX} y={b + 38} color={DC}>
        <Fuse />
      </Place>,
    );
    add(<Wire key="w-b2" pts={[[invX, b + 38 + T], [invX, b + 92 - T]]} color={DC} />);
    add(
      <Place key="bi" x={invX} y={b + 92} color={DC}>
        <Switch mark="isolator" />
      </Place>,
    );
    add(<Wire key="w-b3" pts={[[invX, b + 92 + T], [invX, b + 140]]} color={DC} />);
    add(<BatterySym key="bat" x={invX} y={b + 166} />);
    add(<Label key="bf-l" x={invX + 16} y={b + 34} anchor="start" title="Battery fuse" lines={[`${C.batteryFuseA} A DC · ${mm("batt_inv", "2×")}`]} />);
    add(<Label key="bi-l" x={invX + 16} y={b + 88} anchor="start" title="Battery isolator" lines={[`${C.batteryFuseA} A DC`]} />);
    add(<Label key="bat-l" x={invX + 26} y={b + 160} anchor="start" title="Battery bank" lines={[`${r.battery.seriesCount}S${r.battery.parallelCount}P · ${fmt(r.battery.bankVoltage, 1)} V · ${fmt(r.battery.bankAh)} Ah`, `${fmt(r.battery.bankKWh, 1)} kWh`]} />);
  } else {
    // Charge controller → DC breaker → battery bus → fuse → inverter/charger
    add(<Converter key="cc" cx={c1x} cy={Y} size={BOX} inMark="dc" outMark="dc" colorIn={DC} colorOut={DC} />);
    add(<Label key="cc-l" x={c1x} y={Y - 86} title="MPPT charge controller" lines={[`${r.controller.count} × ${r.controller.ratedA} A · ${r.inverter.systemVoltage} V`, `Max PV ${project.controller.maxPvVoltage} V`]} />);
    const b = Y + BOX / 2;
    const busY = b + 100;
    invX = c1x + BOX + 130;
    add(<Wire key="w-c1" pts={[[c1x, b], [c1x, b + 40 - T]]} color={DC} />);
    add(
      <Place key="cb1" x={c1x} y={b + 40} color={DC}>
        <Switch mark="breaker" />
      </Place>,
    );
    add(<Label key="cb1-l" x={c1x + 16} y={b + 36} anchor="start" title="DC breaker" lines={[`${seg("ctrl_batt")?.protectionA ?? ""} A · ${mm("ctrl_batt", "2×")}`]} />);
    add(<Wire key="w-c2" pts={[[c1x, b + 40 + T], [c1x, busY + 20]]} color={DC} />);
    add(<Dot key="d-bus" at={[c1x, busY]} color={DC} />);
    add(<BatterySym key="bat" x={c1x} y={busY + 46} />);
    add(<Label key="bat-l" x={c1x + 28} y={busY + 40} anchor="start" title="Battery bank" lines={[`${r.battery.seriesCount}S${r.battery.parallelCount}P · ${fmt(r.battery.bankVoltage, 1)} V`, `${fmt(r.battery.bankAh)} Ah · ${fmt(r.battery.bankKWh, 1)} kWh`]} />);
    add(<Wire key="w-bus" pts={[[c1x, busY], [invX, busY], [invX, b + 50 + T]]} color={DC} />);
    add(<CableTag key="c-bus" x={(c1x + invX) / 2} y={busY - 6} text={mm("batt_inv", "2×")} />);
    add(
      <Place key="bf" x={invX} y={b + 50} color={DC}>
        <Fuse />
      </Place>,
    );
    add(<Wire key="w-bf" pts={[[invX, b + 50 - T], [invX, b]]} color={DC} />);
    add(<Label key="bf-l" x={invX + 14} y={b + 46} anchor="start" title="Battery fuse + isolator" lines={[`${C.batteryFuseA} A DC`]} />);
    add(<Converter key="inv" cx={invX} cy={Y} size={BOX} inMark="dc" outMark="ac" colorIn={DC} colorOut={AC} />);
    add(<Label key="inv-l" x={invX + 22} y={Y - 98} anchor="end" title="Inverter/charger" lines={[`${fmt(r.inverter.ratedPowerW / 1000, 1)} kW · ${r.inverter.systemVoltage} V DC / 230 V AC`, `Surge ${fmt(r.inverter.surgePowerW / 1000, 1)} kW`, r.inverter.isSelected ? r.inverter.spec.model : ""]} />);
    pe.push([[c1x - BOX / 2 + 10, Y + BOX / 2], [c1x - BOX / 2 + 10, EY]]);
  }
  pe.push([[invX - BOX / 2 + 10, Y + BOX / 2], [invX - BOX / 2 + 10, EY]]);

  /* ---- AC side ---- */
  const invR = invX + BOX / 2;
  const acbX = invR + 80;
  add(<Wire key="w-ac1" pts={[[invR, Y], [acbX - T, Y]]} color={AC} />);
  add(<CableTag key="c-ac1" x={(invR + acbX - T) / 2 + 4} y={Y - 6} text={mm("ac_out", "3C ")} />);
  add(
    <Place key="acb" x={acbX} y={Y} horizontal color={AC}>
      <Switch mark="breaker" />
    </Place>,
  );
  add(<Label key="acb-l" x={acbX} y={Y - 60} title="AC output MCB" lines={[`${C.acBreakerA} A DP · curve C`]} />);
  const aspdX = acbX + T + 40;
  const dbL = aspdX + 50;
  add(<Wire key="w-ac2" pts={[[acbX + T, Y], [dbL, Y]]} color={AC} />);
  add(<Dot key="d-aspd" at={[aspdX, Y]} color={AC} />);
  add(<Wire key="w-aspd" pts={[[aspdX, Y], [aspdX, Y + 60 - T]]} color={AC} />);
  add(
    <Place key="aspd" x={aspdX} y={Y + 60} color={AC}>
      <Spd />
    </Place>,
  );
  add(<Label key="aspd-l" x={aspdX - 14} y={Y + 56} anchor="end" title="SPD Type 2" lines={["Uc 275 V AC · 20 kA"]} />);
  pe.push([[aspdX, Y + 60 + T], [aspdX, EY]]);

  // Distribution board: busbar with outgoing ways
  const dbW = 110;
  add(
    <g key="db" stroke={AC} fill="none" strokeLinecap="round">
      <rect x={dbL} y={Y - 30} width={dbW} height={60} fill="var(--surface)" strokeWidth={2} />
      <line x1={dbL + 12} y1={Y - 8} x2={dbL + dbW - 12} y2={Y - 8} strokeWidth={4} />
      {[0, 1, 2, 3, 4].map((i) => {
        const wx = dbL + 22 + i * 16.5;
        return <path key={i} d={`M${wx},${Y - 8} v10 l-4,-6 M${wx},${Y + 2} v12`} strokeWidth={1.4} />;
      })}
    </g>,
  );
  add(<Label key="db-l" x={dbL + dbW / 2} y={Y - 60} title="Distribution board" lines={["MCBs + 30 mA RCD", `${fmt(r.load.continuousW)} W design load`]} />);
  pe.push([[dbL + dbW / 2, Y + 30], [dbL + dbW / 2, EY]]);

  const loadX = dbL + dbW + 70;
  add(<Wire key="w-load" pts={[[dbL + dbW, Y], [loadX, Y], [loadX, Y + 22]]} color={AC} />);
  add(<path key="load" d={`M${loadX - 11},${Y + 22} L${loadX + 11},${Y + 22} L${loadX},${Y + 42} Z`} fill={AC} />);
  add(<Label key="load-l" x={loadX} y={Y + 62} title="Loads" lines={[`${fmt(r.load.dailyWh / 1000, 1)} kWh/day`, `${fmt(r.load.continuousW)} W continuous`]} />);

  /* ---- grid / generator input ---- */
  if (grid) {
    const inTop = Y - BOX / 2;
    const riseX = invX + 32;
    const mcbX = invX + 100;
    const meterX = mcbX + 90;
    const gridX = meterX + 150;
    add(<Wire key="w-g1" pts={[[riseX, inTop], [riseX, GY], [mcbX - T, GY]]} color={AC} />);
    add(
      <Place key="g-mcb" x={mcbX} y={GY} horizontal color={AC}>
        <Switch mark="breaker" />
      </Place>,
    );
    add(<Label key="g-mcb-l" x={mcbX} y={GY + 30} title="AC input MCB" lines={[`${C.acBreakerA} A DP${hybrid ? "" : " · changeover"}`]} />);
    add(<Wire key="w-g2" pts={[[mcbX + T, GY], [meterX - 22, GY]]} color={AC} />);
    add(
      <g key="meter">
        <rect x={meterX - 22} y={GY - 15} width={44} height={30} fill="var(--surface)" stroke={AC} strokeWidth={2} />
        <text x={meterX} y={GY + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill={AC}>
          kWh
        </text>
      </g>,
    );
    add(<Label key="meter-l" x={meterX} y={GY + 30} title="Energy meter" lines={["Utility / sub-meter"]} />);
    add(<Wire key="w-g3" pts={[[meterX + 22, GY], [gridX - 32, GY]]} color={AC} />);
    add(<CableTag key="c-g" x={(meterX + 22 + gridX - 32) / 2} y={GY - 6} text={mm("ac_in", "3C ")} />);
    add(
      <g key="gridsrc" stroke={AC} fill="none">
        <rect x={gridX - 32} y={GY - 22} width={64} height={44} fill="var(--surface)" strokeWidth={2} />
        {[-16, -6, 4, 14].map((dx) => (
          <line key={dx} x1={gridX + dx} y1={GY - 22} x2={gridX + dx - 6} y2={GY - 12} strokeWidth={1.3} />
        ))}
        <AcMark x={gridX} y={GY + 6} color={AC} />
      </g>,
    );
    add(<Label key="grid-l" x={gridX} y={GY - 32} title="Grid / generator" lines={[]} />);
    add(<CableTag key="grid-v" x={gridX + 40} y={GY + 4} anchor="start" text="230 V AC 50 Hz" />);
  }

  /* ---- earthing ---- */
  const W = Math.max(1100, loadX + 150, grid ? invX + 100 + 90 + 150 + 170 : 0);
  const electrodeX = W - 60;

  // Title block
  const H = 640;
  const TB = H - 74;
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Single-line diagram with electrical symbols" fontFamily="ui-sans-serif, system-ui, sans-serif">
      <rect width={W} height={H} fill="var(--surface)" />
      <rect x={6} y={6} width={W - 12} height={H - 12} fill="none" stroke="var(--line)" strokeWidth={1.5} />

      {pe.map((pts, i) => (
        <Wire key={`pe${i}`} pts={pts} color={PE} earth />
      ))}
      {parts}

      {/* Main earth bar and electrode */}
      <line x1={pvX - 40} x2={electrodeX} y1={EY} y2={EY} stroke={PE} strokeWidth={4} />
      <Earth x={electrodeX} y={EY} />
      <Label x={pvX - 40} y={EY + 18} anchor="start" title="Main earth terminal" lines={[`${C.earthing.mainEarthMm2} mm² Cu to electrode · bonding ${C.earthing.bondingMm2} mm² G/Y`]} />
      <Label x={electrodeX - 18} y={EY + 18} anchor="end" title="Earth electrode" lines={[`≤ ${C.earthing.targetOhm} Ω`]} />

      {/* Legend */}
      <g transform={`translate(${Math.round(W / 2 - 110)}, ${EY + 34})`} fontSize="10" fill="var(--muted)">
        <rect x={-10} y={-14} width={300} height={24} rx={4} fill="none" stroke="var(--line)" />
        <line x1={0} x2={22} y1={-2} y2={-2} stroke={AC} strokeWidth={2} />
        <text x={28} y={2}>AC</text>
        <line x1={60} x2={82} y1={-2} y2={-2} stroke={DC} strokeWidth={2} />
        <text x={88} y={2}>DC</text>
        <line x1={120} x2={142} y1={-2} y2={-2} stroke={PE} strokeWidth={1.4} strokeDasharray="6 4" />
        <text x={148} y={2}>Protective earth</text>
        <circle cx={250} cy={-2} r={3} fill="var(--muted)" />
        <text x={258} y={2}>Junction</text>
      </g>

      {/* Title block */}
      <g fontSize="10" fill="var(--muted)">
        <rect x={6} y={TB} width={W - 12} height={68} fill="var(--surface)" stroke="var(--line)" strokeWidth={1.5} />
        {[0.24, 0.62, 0.82].map((f) => (
          <line key={f} x1={W * f} x2={W * f} y1={TB} y2={TB + 68} stroke="var(--line)" />
        ))}
        <text x={20} y={TB + 20} fontSize="9" letterSpacing="1">
          DRAWING TITLE
        </text>
        <text x={20} y={TB + 38} fontSize="13" fontWeight="700" fill="var(--text)">
          Single-line diagram
        </text>
        <text x={20} y={TB + 56}>{project.name}</text>
        <text x={W * 0.24 + 14} y={TB + 20} fontSize="9" letterSpacing="1">
          SYSTEM RATINGS
        </text>
        <text x={W * 0.24 + 14} y={TB + 38} fill="var(--text)">
          PV {fmt(r.strings.arrayW / 1000, 2)} kWp · Inverter {fmt(r.inverter.ratedPowerW / 1000, 1)} kW · Battery {fmt(r.battery.bankKWh, 1)} kWh
        </text>
        <text x={W * 0.24 + 14} y={TB + 56}>
          {r.inverter.systemVoltage} V DC · 230 V AC 50 Hz · {hybrid ? "Hybrid" : "Off-grid with charge controller"}
          {grid ? " · grid/generator backup" : ""}
        </text>
        <text x={W * 0.62 + 14} y={TB + 20} fontSize="9" letterSpacing="1">
          DATE
        </text>
        <text x={W * 0.62 + 14} y={TB + 38} fill="var(--text)">
          {today}
        </text>
        <text x={W * 0.62 + 14} y={TB + 56}>{project.compliance.engineerName ? `Engineer: ${project.compliance.engineerName}` : "Engineer: ________"}</text>
        <text x={W * 0.82 + 14} y={TB + 20} fontSize="9" letterSpacing="1">
          SCALE
        </text>
        <text x={W * 0.82 + 14} y={TB + 38} fill="var(--text)">
          NTS · IEC 60617 symbols
        </text>
        <text x={W * 0.82 + 14} y={TB + 56}>{APP_NAME}</text>
      </g>
    </svg>
  );
});

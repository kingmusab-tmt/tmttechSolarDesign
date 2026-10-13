"use client";

import Link from "next/link";
import { fmt } from "@/lib/format";
import { Card, Field, Formula, KeyValue, NumInput, Stat } from "../ui";
import { useProject } from "../project/ProjectProvider";
import { useSection } from "./shared";

/** Horizontal voltage scale: MPPT window, string operating range and the absolute limit. */
function VoltageWindow({ mpptMin, mpptMax, maxDc, vmpHot, vmpCold, vocCold }: { mpptMin: number; mpptMax: number; maxDc: number; vmpHot: number; vmpCold: number; vocCold: number }) {
  const top = Math.max(maxDc, vocCold) * 1.08 || 1;
  const x = (v: number) => 20 + (v / top) * 640;
  const over = vocCold > maxDc;
  const ticks = Array.from({ length: 6 }, (_, i) => Math.round((top / 5) * i));
  return (
    <svg viewBox="0 0 680 150" className="w-full" role="img" aria-label="String voltage versus inverter limits">
      <rect x={x(0)} y={48} width={x(top) - x(0)} height={22} rx={4} fill="var(--surface-2)" />
      <rect x={x(mpptMin)} y={48} width={Math.max(0, x(mpptMax) - x(mpptMin))} height={22} rx={4} fill="var(--good-soft)" stroke="var(--good)" strokeWidth={1} />
      <text x={(x(mpptMin) + x(mpptMax)) / 2} y={63} textAnchor="middle" fontSize="11" fill="var(--good)">
        MPPT window {mpptMin}–{mpptMax} V
      </text>
      <line x1={x(maxDc)} x2={x(maxDc)} y1={30} y2={92} stroke="var(--bad)" strokeWidth={2} />
      <text x={x(maxDc)} y={24} textAnchor="middle" fontSize="11" fill="var(--bad)">
        Max DC {maxDc} V
      </text>
      {/* String operating range: Vmp (hot) to Vmp (cold) */}
      <line x1={x(vmpHot)} x2={x(vmpCold)} y1={100} y2={100} stroke="var(--series-1)" strokeWidth={4} strokeLinecap="round" />
      <circle cx={x(vmpHot)} cy={100} r={5} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
      <circle cx={x(vmpCold)} cy={100} r={5} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
      <text x={x(vmpHot)} y={120} textAnchor="middle" fontSize="10" fill="var(--muted)">
        Vmp hot {fmt(vmpHot, 0)} V
      </text>
      <text x={x(vmpCold)} y={134} textAnchor="middle" fontSize="10" fill="var(--muted)">
        Vmp cold {fmt(vmpCold, 0)} V
      </text>
      <path d={`M${x(vocCold)},86 l-6,-10 h12 z`} fill={over ? "var(--bad)" : "var(--text)"} />
      <text x={x(vocCold)} y={145} textAnchor="middle" fontSize="11" fontWeight="600" fill={over ? "var(--bad)" : "var(--text)"}>
        Voc cold {fmt(vocCold, 0)} V
      </text>
      {ticks.map((t) => (
        <text key={t} x={x(t)} y={84} textAnchor="middle" fontSize="9" fill="var(--muted)">
          {t}
        </text>
      ))}
    </svg>
  );
}

export function StringsStep() {
  const { results, project } = useProject();
  const [str, setStr] = useSection("strings");
  const [site, setSite] = useSection("site");
  const S = results.strings;
  const panel = project.pv.panel;
  const d = S.device;
  const editHref = `/projects/${project._id}/${project.inverter.type === "hybrid" ? "inverter" : "controller"}`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Max panels per string" value={S.maxSeries} hint={`From Voc at ${site.tMin} °C`} />
        <Stat label="Min panels per string" value={S.minSeries} hint={`From Vmp at ${fmt(S.cellTempHot, 0)} °C cell temperature`} />
        <Stat label="Configuration" value={`${S.series} × ${S.parallel}`} hint={`${S.series} in series × ${S.parallel} parallel string(s) = ${S.totalPanels} panels`} tone="accent" />
        <Stat label="String Voc (cold)" value={fmt(S.stringVocCold, 1)} unit="V" tone={S.stringVocCold > d.maxDcVoltage ? "bad" : "good"} hint={`Limit ${d.maxDcVoltage} V`} />
      </div>

      <Card title="String voltage vs. device limits" subtitle={`PV input device: ${d.label}`}>
        <VoltageWindow mpptMin={d.mpptMinV} mpptMax={d.mpptMaxV} maxDc={d.maxDcVoltage} vmpHot={S.stringVmpHot} vmpCold={S.stringVmpCold} vocCold={S.stringVocCold} />
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Maximum string length: cold Voc" subtitle="Panel voltage rises as temperature falls">
          <div className="space-y-3">
            <Formula expr="V_max = Voc × [1 + (β/100) × (T_min − 25)]" />
            <Formula title="1. Temperature difference" expr={`ΔT = T_min − T_STC = ${site.tMin} − 25 = ${fmt(S.tDiff, 1)} °C`} />
            <Formula title="2. Voltage increase" expr={`ΔT × β = ${fmt(S.tDiff, 1)} × (${panel.betaVocPct}/100)`} result={`= ${fmt(S.vocIncreasePct, 2)} %`} />
            <Formula title="3. Panel V_max" expr={`${panel.vocV} V × (1 + ${fmt(S.vocIncreasePct / 100, 4)})`} result={`= ${fmt(S.vocCold, 2)} V per panel`} />
            <Formula title="4. Max panels in series (round down)" expr={`⌊${d.maxDcVoltage} V ÷ ${fmt(S.vocCold, 2)} V⌋ = ⌊${fmt(d.maxDcVoltage / S.vocCold, 2)}⌋`} result={`= ${S.maxSeries} panels`} />
          </div>
        </Card>
        <Card title="Minimum string length: hot Vmp" subtitle="The string must stay inside the MPPT window during peak daytime heat">
          <div className="space-y-3">
            <Formula title="Cell temperature" expr="T_cell = T_max + (NOCT − 20) / 800 × 1000" sub={`= ${site.tMax} + (${panel.noctC} − 20) / 800 × 1000`} result={`= ${fmt(S.cellTempHot, 1)} °C`} />
            <Formula title="Panel Vmp at T_cell" expr="Vmp_hot = Vmp × [1 + (γ/100) × (T_cell − 25)]" sub={`= ${panel.vmpV} × [1 + (${panel.gammaPmaxPct}/100) × ${fmt(S.cellTempHot - 25, 1)}]`} result={`= ${fmt(S.vmpHot, 2)} V`} />
            <Formula title="Min panels in series (round up)" expr={`⌈${fmt(d.mpptMinV, 0)} V ÷ ${fmt(S.vmpHot, 2)} V⌉`} result={`= ${S.minSeries} panels`} />
            <Formula title="MPPT upper bound" expr={`⌊${d.mpptMaxV} V ÷ Vmp_cold ${fmt(S.vmpCold, 2)} V⌋`} result={`= ${S.maxSeriesMppt} panels`} />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Configuration" subtitle="Auto picks the fewest panels that meet the requirement within the window; override if needed">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Panels per string" hint="0 = automatic">
              <NumInput value={str.seriesOverride} min={0} max={100} step={1} onChange={(seriesOverride) => setStr({ seriesOverride })} />
            </Field>
            <Field label="Parallel strings" hint="0 = automatic">
              <NumInput value={str.parallelOverride} min={0} max={200} step={1} onChange={(parallelOverride) => setStr({ parallelOverride })} />
            </Field>
            <Field label="Record low (Tmin)">
              <NumInput value={site.tMin} min={-60} max={50} onChange={(tMin) => setSite({ tMin })} suffix="°C" />
            </Field>
            <Field label="Record high (Tmax)">
              <NumInput value={site.tMax} min={-20} max={60} onChange={(tMax) => setSite({ tMax })} suffix="°C" />
            </Field>
          </div>
          <p className="mt-4 text-xs text-muted">
            Device limits come from the{" "}
            <Link className="underline" href={editHref}>
              {d.label} specification
            </Link>
            .
          </p>
        </Card>
        <Card title="String electrical summary">
          <KeyValue
            rows={[
              ["Strings per MPPT", `${S.stringsPerMppt} (of ${d.mpptCount} MPPT${d.mpptCount > 1 ? "s" : ""})`],
              ["String Vmp at STC", `${fmt(S.stringVmp, 1)} V`],
              ["String Vmp, hot / cold", `${fmt(S.stringVmpHot, 1)} V / ${fmt(S.stringVmpCold, 1)} V`],
              ["String Voc at Tmin", `${fmt(S.stringVocCold, 1)} V`],
              ["MPPT operating current", `${fmt(S.mpptCurrentA, 1)} A${d.maxInputCurrentA ? ` (limit ${d.maxInputCurrentA} A)` : ""}`],
              ["MPPT short-circuit current", `${fmt(S.mpptIscA, 1)} A${d.maxIscA ? ` (limit ${d.maxIscA} A)` : ""}`],
              ["Array power", `${fmt(S.arrayW)} Wp`],
              ["DC/AC ratio", fmt(S.dcAcRatio, 2)],
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

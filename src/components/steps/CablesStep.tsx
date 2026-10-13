"use client";

import { fmt } from "@/lib/format";
import type { CableSettings } from "@/lib/schemas";
import { Card, Field, Formula, KeyValue, NumInput } from "../ui";
import { useProject } from "../project/ProjectProvider";
import { useSection } from "./shared";

const LENGTH_FIELD: Record<string, keyof CableSettings> = {
  pv_string: "pvStringLengthM",
  pv_array: "pvArrayLengthM",
  ctrl_batt: "ctrlBattLengthM",
  batt_inv: "battInvLengthM",
  ac_out: "acOutLengthM",
  ac_in: "acInLengthM",
};

export function CablesStep() {
  const { results } = useProject();
  const [cab, setCab] = useSection("cables");
  const C = results.cables;
  const batt = C.segments.find((s) => s.key === "batt_inv");

  return (
    <div className="space-y-6">
      <Card title="Cable schedule" subtitle="Each size satisfies both the voltage-drop limit (operating current) and the ampacity of its protective device (Iz ≥ In)" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="table min-w-[1000px]">
            <thead>
              <tr>
                <th>Circuit</th>
                <th className="w-28">One-way length</th>
                <th className="text-right">Voltage</th>
                <th className="text-right">I op.</th>
                <th className="text-right">Min area (ΔV)</th>
                <th className="text-right">Selected</th>
                <th className="text-right">Drop</th>
                <th>Protection</th>
              </tr>
            </thead>
            <tbody>
              {C.segments.map((s) => (
                <tr key={s.key}>
                  <td>
                    <div className="font-medium">{s.label}</div>
                    <div className="text-[11px] text-muted">
                      {s.kind.toUpperCase()} · {s.runs > 1 ? `${s.runs} identical circuits · ` : ""}limit {s.maxDropPct} %
                    </div>
                  </td>
                  <td>
                    <NumInput value={cab[LENGTH_FIELD[s.key]] as number} min={0} onChange={(v) => setCab({ [LENGTH_FIELD[s.key]]: v })} suffix="m" />
                  </td>
                  <td className="num text-right">{fmt(s.voltageV, 1)} V</td>
                  <td className="num text-right">{fmt(s.operatingA, 1)} A</td>
                  <td className="num text-right">{fmt(s.minAreaDrop, 2)} mm²</td>
                  <td className="num text-right font-semibold">{s.sizeMm2} mm²</td>
                  <td className={`num text-right ${s.dropPct > s.maxDropPct ? "text-bad" : ""}`}>{fmt(s.dropPct, 2)} %</td>
                  <td className="text-xs">{s.protectionLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Design limits">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="PV DC voltage drop limit">
              <NumInput value={cab.dcDropPct} min={0.1} max={10} step={0.5} onChange={(dcDropPct) => setCab({ dcDropPct })} suffix="%" />
            </Field>
            <Field label="Battery DC drop limit" hint="Keep it low: high current at low voltage">
              <NumInput value={cab.batteryDropPct} min={0.1} max={10} step={0.5} onChange={(batteryDropPct) => setCab({ batteryDropPct })} suffix="%" />
            </Field>
            <Field label="AC voltage drop limit">
              <NumInput value={cab.acDropPct} min={0.1} max={10} step={0.5} onChange={(acDropPct) => setCab({ acDropPct })} suffix="%" />
            </Field>
            <Field label="AC system voltage">
              <NumInput value={cab.acVoltage} min={100} max={480} onChange={(acVoltage) => setCab({ acVoltage })} suffix="V" />
            </Field>
          </div>
          <div className="mt-4 space-y-3">
            <Formula title="Cross-section for voltage drop" expr="A = (2 × L × I × ρ) / ΔV,   ρ_Cu = 0.0175 Ω·mm²/m" sub={batt ? `Battery cable: (2 × ${batt.lengthM} × ${fmt(batt.operatingA, 1)} × 0.0175) / (${batt.maxDropPct} % × ${batt.voltageV} V)` : undefined} result={batt ? `= ${fmt(batt.minAreaDrop, 2)} mm² → ${batt.sizeMm2} mm²` : undefined} />
            <p className="text-[11px] text-muted">The ampacity table is indicative (IEC 60364-5-52, method C, 30 °C). Derate for grouping, conduit and high ambient temperatures on site.</p>
          </div>
        </Card>
        <Card title="Protection & earthing summary">
          <KeyValue
            rows={[
              ["PV string fuses", C.stringFuseA ? `${C.stringFuseA} A gPV, on both + and − (≥ 3 strings)` : "Not required (< 3 parallel strings)"],
              ["PV DC isolator / breaker", `${C.dcIsolatorA} A, ≥ ${C.dcIsolatorV} V DC`],
              ["DC surge protection", `Type II DC SPD, Ucpv ≥ ${C.dcSpdUcpv} V`],
              ["Battery protection", `${C.batteryFuseA} A Class-T / NH fuse + isolator`],
              ["AC output protection", `${C.acBreakerA} A DP MCB + 30 mA RCD on final circuits`],
              ["AC surge protection", C.acSpd],
              ["Equipotential bonding", `${C.earthing.bondingMm2} mm² Cu (module frames, rails)`],
              ["Main earthing conductor", `${C.earthing.mainEarthMm2} mm² Cu`],
              ["Earth electrode", `${C.earthing.electrode}, target ≤ ${C.earthing.targetOhm} Ω`],
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

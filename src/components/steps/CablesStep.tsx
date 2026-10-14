"use client";

import { fmt } from "@/lib/format";
import type { CableSettings } from "@/lib/schemas";
import { INSTALL_METHOD } from "@/lib/calc/constants";
import { Card, Field, Formula, KeyValue, NumInput, Select } from "../ui";
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
  const { results, project } = useProject();
  const [cab, setCab] = useSection("cables");
  const C = results.cables;
  const batt = C.segments.find((s) => s.key === "batt_inv");
  const P = results.protection;

  return (
    <div className="space-y-6">
      <Card title="Cable schedule" subtitle="Each size satisfies both the voltage-drop limit (operating current) and, after derating, the rating of its protective device (Iz ≥ In)" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="table min-w-[1260px]">
            <thead>
              <tr>
                <th>Circuit</th>
                <th className="w-32">One-way length</th>
                <th className="text-right">Voltage</th>
                <th className="text-right">I op.</th>
                <th className="text-right">Min area (ΔV)</th>
                <th className="text-right">Selected</th>
                <th className="text-right">Drop</th>
                <th className="text-right" title="Derated current-carrying capacity = table value × Ca × Cg × Cm">Iz (derated)</th>
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
                  <td className={`num text-right ${s.ampacityA < s.protectionA ? "text-bad" : ""}`} title={`${s.baseAmpacityA} A × Ca ${fmt(s.derating.ca, 2)} (${s.derating.ambientC} °C, ${s.derating.conductorMaxC} °C cable) × Cg ${fmt(s.derating.cg, 2)} × Cm ${fmt(s.derating.cm, 2)}`}>
                    {fmt(s.ampacityA, 1)} A
                    <div className="text-[10px] font-normal text-muted">× {fmt(s.derating.total, 2)} · {s.derating.ambientC} °C</div>
                  </td>
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
          </div>
        </Card>
        <Card title="Derating (IEC 60364-5-52)" subtitle="Cable ratings fall in hot air, when cables are bunched and when they are enclosed">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Air temperature indoors / plant room" hint={cab.indoorAmbientC > 0 ? "Battery, inverter and AC cables" : `Using the site record high (${project.site.tMax} °C); enter a value to override`}>
              <NumInput value={cab.indoorAmbientC} min={0} max={80} onChange={(indoorAmbientC) => setCab({ indoorAmbientC })} suffix="°C" />
            </Field>
            <Field label="Air temperature at the PV cables" hint="Cables on a roof in the sun or behind modules reach 60–70 °C">
              <NumInput value={cab.roofAmbientC} min={20} max={90} onChange={(roofAmbientC) => setCab({ roofAmbientC })} suffix="°C" />
            </Field>
            <Field label="Installation method">
              <Select value={cab.installMethod} onChange={(installMethod) => setCab({ installMethod })} options={Object.entries(INSTALL_METHOD).map(([value, m]) => ({ value: value as typeof cab.installMethod, label: `${m.label} (× ${m.factor})` }))} />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={cab.bunchStrings} onChange={(e) => setCab({ bunchStrings: e.target.checked })} />
              PV string cables run together (grouping factor)
            </label>
          </div>
          <div className="mt-4">
            <Formula title="Derated capacity" expr="Iz = It × Ca × Cg × Cm ≥ In,   Ca = √((θmax − θambient) / 60)" sub="It: table value at 30 °C (XLPE, method C). θmax: 120 °C for EN 50618 PV cable, 90 °C for XLPE/HEPR. Cg: grouping, Cm: installation method." />
          </div>
        </Card>
        <Card title="Fault level & coordination">
          <KeyValue
            rows={[
              ["Battery prospective short-circuit", `≈ ${fmt(P.batteryIscKA, 1)} kA`],
              ["Battery protective device", P.batteryDevice],
              ["Inverter fault current (backup mode)", `≈ ${fmt(P.inverterFaultA)} A (${cab.inverterFaultFactor} × rated)`],
              ["Circuits relying on RCD / inverter shutdown", P.circuitsRelyingOnRcd.length ? P.circuitsRelyingOnRcd.join(", ") : "None"],
            ]}
          />
          <div className="mt-4 max-w-xs">
            <Field label="Inverter short-circuit output" hint="Multiple of rated current from the inverter datasheet (typically 1.5–3)">
              <NumInput value={cab.inverterFaultFactor} min={1} max={20} step={0.1} onChange={(inverterFaultFactor) => setCab({ inverterFaultFactor })} suffix="× In" />
            </Field>
          </div>
          <p className="mt-3 text-[11px] text-muted">In backup mode only the inverter feeds a fault, usually too little to trip a breaker instantly. Every final circuit therefore has a 30 mA RCBO, and B-curve breakers are preferred.</p>
        </Card>
        <Card title="Protection & earthing summary">
          <KeyValue
            rows={[
              ["PV string fuses", C.stringFuseA ? `${C.stringFuseA} A gPV, on both + and − (≥ 3 strings)` : "Not required (< 3 parallel strings)"],
              ["PV DC isolator / breaker", `${C.dcIsolatorA} A, ≥ ${C.dcIsolatorV} V DC`],
              ["DC surge protection", `Type II DC SPD, Ucpv ≥ ${C.dcSpdUcpv} V`],
              ["Battery protection", `${P.batteryDevice} + isolator`],
              ["AC output protection", `${C.acBreakerA} A DP MCB + 30 mA RCD on final circuits`],
              ["AC surge protection", P.lightning.acSpd],
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

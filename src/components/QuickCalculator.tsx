"use client";

import { useEffect, useMemo, useState } from "react";
import { STD_CONTROLLER_A, STD_INVERTER_W, nextStd } from "@/lib/calc/constants";
import { autoSystemVoltage, batteryAh, controllerCurrent, maxSeriesPanels, vocAtTemp } from "@/lib/calc/sizing";
import { fmt } from "@/lib/format";
import { Card, Field, Formula, NumInput, Stat } from "./ui";

const DEFAULTS = {
  dailyWh: 5000,
  continuousW: 1500,
  surgeW: 2500,
  autonomy: 1,
  dod: 0.9,
  invEff: 0.9,
  sysEff: 0.75,
  psh: 4.5,
  panelW: 450,
  voc: 41.5,
  beta: -0.29,
  tMin: 0,
  maxDc: 600,
};
type State = typeof DEFAULTS;
const KEY = "shs-quick-calc";

/** Fully client-side, so it also works offline once the PWA is installed. */
export function QuickCalculator() {
  const [s, setS] = useState<State>(DEFAULTS);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setS({ ...DEFAULTS, ...JSON.parse(saved) });
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {}
  }, [s]);
  const set = (k: keyof State) => (v: number) => setS((p) => ({ ...p, [k]: v }));

  const r = useMemo(() => {
    const invReq = s.continuousW * 1.25;
    const V = autoSystemVoltage(invReq);
    const ah = batteryAh(s.dailyWh, s.autonomy, V, s.dod, s.invEff);
    const gen = s.dailyWh / s.sysEff;
    const pvW = gen / s.psh;
    const panels = Math.ceil(pvW / s.panelW);
    const ccA = controllerCurrent(panels * s.panelW, V);
    const vmax = vocAtTemp(s.voc, s.beta, s.tMin);
    return { invReq, invStd: nextStd(STD_INVERTER_W, invReq), V, ah, gen, pvW, panels, ccA, ccStd: nextStd(STD_CONTROLLER_A, ccA), vmax, maxSeries: maxSeriesPanels(s.maxDc, vmax) };
  }, [s]);

  const fields: [keyof State, string, string, number?][] = [
    ["dailyWh", "Total daily energy", "Wh"],
    ["continuousW", "Total continuous power", "W"],
    ["surgeW", "Peak surge power", "W"],
    ["autonomy", "Days of autonomy", "days", 0.5],
    ["dod", "Battery DoD", "", 0.05],
    ["invEff", "Inverter efficiency", "", 0.01],
    ["sysEff", "System efficiency", "", 0.01],
    ["psh", "Peak sun hours", "h", 0.1],
    ["panelW", "Panel rating", "W"],
    ["voc", "Panel Voc", "V", 0.1],
    ["beta", "β Voc", "%/°C", 0.01],
    ["tMin", "Record low temperature", "°C"],
    ["maxDc", "Inverter max DC input", "V"],
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">Quick sizing calculator</h1>
      <p className="text-sm text-muted">The six core sizing formulas in one place. Runs entirely in your browser and works offline. For a full design, create a project.</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card title="Inputs" actions={<button className="btn btn-sm" onClick={() => setS(DEFAULTS)}>Reset</button>}>
          <div className="grid grid-cols-2 gap-3">
            {fields.map(([k, label, unit, step]) => (
              <Field key={k} label={label}>
                <NumInput value={s[k]} step={step ?? 1} onChange={set(k)} suffix={unit} />
              </Field>
            ))}
          </div>
        </Card>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat label="Inverter" value={fmt(r.invStd / 1000, 1)} unit="kW" hint={`≥ ${fmt(r.invReq)} W · surge ≥ ${fmt(s.surgeW)} W`} tone="accent" />
            <Stat label="System voltage" value={r.V} unit="V" />
            <Stat label="Battery bank" value={fmt(r.ah)} unit={`Ah @ ${r.V} V`} hint={`${fmt((r.ah * r.V) / 1000, 1)} kWh`} />
            <Stat label="PV array" value={fmt(r.pvW)} unit="Wp" hint={`${r.panels} × ${s.panelW} W panels`} />
            <Stat label="Charge controller" value={r.ccStd} unit="A" hint={`${fmt(r.ccA, 1)} A required (skip for a hybrid inverter)`} />
            <Stat label="Max panels per string" value={r.maxSeries} hint={`Voc at ${s.tMin} °C = ${fmt(r.vmax, 2)} V`} />
          </div>
          <Card title="Working">
            <div className="grid gap-3 md:grid-cols-2">
              <Formula title="1 · Inverter" expr="P ≥ P_cont × 1.25" sub={`${fmt(s.continuousW)} × 1.25`} result={`= ${fmt(r.invReq)} W`} />
              <Formula title="2 · Battery" expr="Ah = (Wh × days) / (V × DoD × η)" sub={`(${fmt(s.dailyWh)} × ${s.autonomy}) / (${r.V} × ${s.dod} × ${s.invEff})`} result={`= ${fmt(r.ah, 1)} Ah`} />
              <Formula title="3 · Generation" expr="E = Wh / η_sys" sub={`${fmt(s.dailyWh)} / ${s.sysEff}`} result={`= ${fmt(r.gen)} Wh/day`} />
              <Formula title="4 · PV power" expr="P_pv = E / PSH" sub={`${fmt(r.gen)} / ${s.psh}`} result={`= ${fmt(r.pvW)} Wp → ${r.panels} panels`} />
              <Formula title="5 · Charge controller" expr="I = P_pv / V × 1.25" sub={`${fmt(r.panels * s.panelW)} / ${r.V} × 1.25`} result={`= ${fmt(r.ccA, 1)} A`} />
              <Formula title="6 · String limit" expr="Vmax = Voc × [1 + β/100 × (Tmin − 25)]" sub={`${s.voc} × [1 + ${s.beta}/100 × (${s.tMin} − 25)] = ${fmt(r.vmax, 2)} V`} result={`⌊${s.maxDc} / ${fmt(r.vmax, 2)}⌋ = ${r.maxSeries} panels`} />
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}

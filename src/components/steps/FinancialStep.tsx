"use client";

import { useState } from "react";
import { fmt, money } from "@/lib/format";
import type { FinancialSettings } from "@/lib/schemas";
import { CashFlowChart } from "../charts/CashFlowChart";
import { Card, Field, NumInput, Stat } from "../ui";
import { useProject } from "../project/ProjectProvider";
import { useSection } from "./shared";

export function FinancialStep() {
  const { results, project } = useProject();
  const [fin, setFin] = useSection("financial");
  const [showTable, setShowTable] = useState(false);
  const F = results.financial;
  const cur = project.boq.currency;

  const inputs: [keyof FinancialSettings, string, string, string?][] = [
    ["monthlyGridCost", "Current monthly grid bill", cur],
    ["monthlyGeneratorCost", "Monthly generator fuel + maintenance", cur],
    ["displacementPct", "Share of that spend displaced by solar", "%"],
    ["escalationPct", "Annual energy price escalation", "%", "Tariff and fuel inflation"],
    ["discountRatePct", "Discount rate", "%", "Cost of capital, for NPV / LCOE"],
    ["omPctOfCapex", "O&M cost per year", "% capex"],
    ["degradationPct", "PV degradation per year", "%"],
    ["lifetimeYears", "Analysis period", "years"],
    ["batteryLifeYears", "Battery replacement interval", "years", `0 = by chemistry (${F.batteryLifeYears} years)`],
    ["inverterLifeYears", "Inverter replacement interval", "years", "0 = none"],
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Capital cost" value={money(F.capex, cur)} hint="From the BoQ grand total" />
        <Stat label="Year-1 savings" value={money(F.year1Savings, cur)} hint={`${money(F.year1Savings / 12, cur)}/month`} />
        <Stat label="Simple payback" value={F.paybackYears !== null ? fmt(F.paybackYears, 1) : "> life"} unit={F.paybackYears !== null ? "years" : ""} tone={F.paybackYears !== null && F.paybackYears < fin.lifetimeYears / 2 ? "good" : "warn"} />
        <Stat label="Net present value" value={money(F.npv, cur)} tone={F.npv > 0 ? "good" : "bad"} hint={`At ${fin.discountRatePct} % discount rate`} />
        <Stat label="Internal rate of return" value={F.irr !== null ? fmt(F.irr * 100, 1) : "–"} unit="%" />
        <Stat label="Levelised cost of energy" value={money(F.lcoe, cur)} unit="/kWh" hint={`Current energy cost ≈ ${money(F.baselineCostPerKWh, cur)}/kWh`} />
        <Stat label={`Lifetime net savings (${fin.lifetimeYears} y)`} value={money(F.lifetimeSavings, cur)} hint={`ROI ${fmt(F.roiPct)} %`} />
        <Stat label="CO₂ avoided" value={fmt(F.co2AvoidedTonnesPerYear, 1)} unit="t/year" hint="Against generator supply (≈ 0.8 kg/kWh)" />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card title="Cumulative cash position" subtitle="Initial investment recovered by avoided grid and generator costs, net of O&M and replacements">
          <CashFlowChart flows={F.flows} capex={F.capex} currency={cur} />
        </Card>
        <Card title="Assumptions">
          <div className="grid gap-3">
            {inputs.map(([k, label, unit, hint]) => (
              <Field key={k} label={label} hint={hint}>
                <NumInput value={fin[k]} min={k === "escalationPct" ? -50 : 0} onChange={(v) => setFin({ [k]: v })} suffix={unit} />
              </Field>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Annual cash flows" actions={<button className="btn btn-sm" onClick={() => setShowTable((v) => !v)}>{showTable ? "Hide" : "Show"} table</button>} bodyClassName={showTable ? "p-0" : "p-5"}>
        {showTable ? (
          <div className="overflow-x-auto">
            <table className="table min-w-[760px]">
              <thead>
                <tr>
                  <th>Year</th>
                  <th className="text-right">Energy (kWh)</th>
                  <th className="text-right">Savings</th>
                  <th className="text-right">O&M</th>
                  <th className="text-right">Replacements</th>
                  <th className="text-right">Net</th>
                  <th className="text-right">Cumulative</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>0</td>
                  <td />
                  <td />
                  <td />
                  <td />
                  <td className="num text-right">{money(-F.capex, cur)}</td>
                  <td className="num text-right">{money(-F.capex, cur)}</td>
                </tr>
                {F.flows.map((f) => (
                  <tr key={f.year}>
                    <td>{f.year}</td>
                    <td className="num text-right">{fmt(f.energyKWh)}</td>
                    <td className="num text-right">{money(f.savings, cur)}</td>
                    <td className="num text-right">{money(-f.om, cur)}</td>
                    <td className="num text-right">{f.replacements ? money(-f.replacements, cur) : "–"}</td>
                    <td className="num text-right">{money(f.net, cur)}</td>
                    <td className={`num text-right font-medium ${f.cumulative < 0 ? "text-bad" : "text-good"}`}>{money(f.cumulative, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">Year-by-year savings, O&M, battery and inverter replacements, and the cumulative position.</p>
        )}
      </Card>
    </div>
  );
}

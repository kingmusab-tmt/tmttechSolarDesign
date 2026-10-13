"use client";

import { useState } from "react";
import { APPLIANCE_PRESETS, presetToLoad } from "@/lib/appliances";
import { fmt } from "@/lib/format";
import { LOAD_CATEGORIES, type LoadItem } from "@/lib/schemas";
import { HBarChart } from "../charts/HBarChart";
import { Card, Field, Formula, NumInput, Stat } from "../ui";
import { useProject } from "../project/ProjectProvider";
import { useSection } from "./shared";

export function LoadsStep() {
  const { project, results, update } = useProject();
  const [inv, setInv] = useSection("inverter");
  const [preset, setPreset] = useState("");
  const loads = project.loads;
  const L = results.load;

  const setRow = (id: string, patch: Partial<LoadItem>) => update("loads", (prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeRow = (id: string) => update("loads", (prev) => prev.filter((l) => l.id !== id));
  const addRow = (item?: LoadItem) =>
    update("loads", (prev) => [...prev, item ?? { id: Math.random().toString(36).slice(2, 10), name: "New appliance", category: "Other", watts: 100, qty: 1, hoursPerDay: 4, inductive: false, surgeFactor: 1 }]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total connected power" value={fmt(L.connectedW)} unit="W" hint="All appliances on at once" />
        <Stat label="Design continuous power" value={fmt(L.continuousW)} unit="W" hint={`Connected × demand factor ${inv.demandFactor}`} />
        <Stat label="Total daily energy" value={fmt(L.dailyWh / 1000, 2)} unit="kWh/day" tone="accent" hint={`${fmt(L.dailyWh)} Wh/day: sizes the battery and the PV`} />
        <Stat label="Peak surge demand" value={fmt(L.peakSurgeW)} unit="W" hint={L.largestMotorName ? `Includes ${L.largestMotorName} starting` : "No inductive loads"} />
      </div>

      <Card
        title="Appliance schedule"
        subtitle="List every appliance that will run on the solar system"
        actions={
          <>
            <select className="input w-56 py-1.5" value={preset} onChange={(e) => setPreset(e.target.value)} aria-label="Appliance preset">
              <option value="">Add from presets…</option>
              {APPLIANCE_PRESETS.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} ({p.watts} W)
                </option>
              ))}
            </select>
            <button
              className="btn btn-sm"
              disabled={!preset}
              onClick={() => {
                const p = APPLIANCE_PRESETS.find((x) => x.name === preset);
                if (p) addRow(presetToLoad(p));
                setPreset("");
              }}
            >
              Add preset
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => addRow()}>
              + Blank row
            </button>
          </>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="table min-w-[980px]">
            <thead>
              <tr>
                <th className="w-[22%]">Appliance</th>
                <th>Category</th>
                <th className="w-24">Power (W)</th>
                <th className="w-20">Qty</th>
                <th className="w-24">Hours/day</th>
                <th className="w-20 text-center" title="Motor / compressor load with high starting current">
                  Inductive
                </th>
                <th className="w-24">Surge ×</th>
                <th className="text-right">Total W</th>
                <th className="text-right">Wh/day</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {L.rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input className="input py-1.5" value={r.name} onChange={(e) => setRow(r.id, { name: e.target.value })} aria-label="Appliance name" />
                  </td>
                  <td>
                    <select className="input py-1.5" value={r.category} onChange={(e) => setRow(r.id, { category: e.target.value })} aria-label="Category">
                      {LOAD_CATEGORIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <NumInput value={r.watts} min={0} onChange={(watts) => setRow(r.id, { watts })} />
                  </td>
                  <td>
                    <NumInput value={r.qty} min={0} step={1} onChange={(qty) => setRow(r.id, { qty })} />
                  </td>
                  <td>
                    <NumInput value={r.hoursPerDay} min={0} max={24} onChange={(hoursPerDay) => setRow(r.id, { hoursPerDay })} />
                  </td>
                  <td className="text-center">
                    <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={r.inductive} onChange={(e) => setRow(r.id, { inductive: e.target.checked, surgeFactor: e.target.checked ? Math.max(r.surgeFactor, 3) : 1 })} aria-label="Inductive load" />
                  </td>
                  <td>
                    <NumInput value={r.surgeFactor} min={1} max={10} disabled={!r.inductive} onChange={(surgeFactor) => setRow(r.id, { surgeFactor })} />
                  </td>
                  <td className="num text-right">{fmt(r.totalW)}</td>
                  <td className="num text-right font-medium">{fmt(r.dailyWh)}</td>
                  <td className="text-right">
                    <button className="btn btn-sm text-bad" onClick={() => removeRow(r.id)} aria-label={`Remove ${r.name}`}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              {!loads.length && (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-sm text-muted">
                    No appliances yet. Add from the presets or add a blank row.
                  </td>
                </tr>
              )}
            </tbody>
            {loads.length > 0 && (
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={7} className="px-3 py-2 text-right">
                    Totals
                  </td>
                  <td className="num px-3 py-2 text-right">{fmt(L.connectedW)} W</td>
                  <td className="num px-3 py-2 text-right">{fmt(L.dailyWh)} Wh</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Daily energy by category" subtitle="Where the energy goes: target the largest bars for efficiency savings">
          <HBarChart title="Daily energy by category" data={L.byCategory.filter((c) => c.dailyWh > 0).map((c) => ({ label: c.category, value: c.dailyWh / 1000 }))} unit="kWh" format={(v) => v.toFixed(2)} />
        </Card>
        <Card title="Calculation" subtitle="How the load totals are derived">
          <div className="space-y-3">
            <Formula title="Total daily energy" expr="E = Σ (P × qty × hours)" result={`= ${fmt(L.dailyWh)} Wh/day`} />
            <Formula title="Peak surge" expr="P_peak = P_continuous + P_motor × (surge − 1)" sub={`= ${fmt(L.continuousW)} + ${fmt(L.largestMotorExtraW)}`} result={`= ${fmt(L.peakSurgeW)} W`} />
            <Field label="Demand (diversity) factor" hint="Fraction of the connected load expected on simultaneously. Use 1.0 for a conservative design.">
              <NumInput value={inv.demandFactor} min={0.1} max={1} step={0.05} onChange={(demandFactor) => setInv({ demandFactor })} />
            </Field>
          </div>
        </Card>
      </div>
    </div>
  );
}

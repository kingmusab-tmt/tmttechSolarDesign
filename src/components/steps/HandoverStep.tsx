"use client";

import { FUNCTIONAL_TESTS, ISC_TOLERANCE_PCT, RCD_MAX_MS, VOC_TOLERANCE_PCT, type TestStatus } from "@/lib/calc/commissioning";
import { GRID_SETTINGS, maintenancePlan, suggestedWarranties } from "@/lib/calc/handover";
import { fmt } from "@/lib/format";
import type { GridConnection, StringTest, WarrantyItem } from "@/lib/schemas";
import { Card, Field, KeyValue, NumInput, Select, Stat, cx } from "../ui";
import { useProject } from "../project/ProjectProvider";
import { useSection } from "./shared";

const RESULT: Record<TestStatus, { label: string; cls: string }> = {
  pass: { label: "Pass", cls: "bg-good-soft text-good" },
  fail: { label: "Fail", cls: "bg-bad-soft text-bad" },
  untested: { label: "–", cls: "bg-surface-2 text-muted" },
};

export function ResultPill({ status }: { status: TestStatus }) {
  const r = RESULT[status];
  return <span className={cx("inline-block min-w-10 rounded-full px-2 py-0.5 text-center text-[11px] font-semibold", r.cls)}>{r.label}</span>;
}

const dev = (v: number | null) => (v === null ? "" : `${v >= 0 ? "+" : ""}${fmt(v, 1)} %`);

export function HandoverStep() {
  const { results, project } = useProject();
  const [h, setH] = useSection("handover");
  const C = results.commissioning;
  const grid = project.site.gridAvailable;

  const setString = (key: string, patch: Partial<StringTest>) => setH({ stringTests: { ...h.stringTests, [key]: { ...C.strings.find((s) => s.key === key)!.test, ...patch } } });
  const G = results.grid;
  const setGrid = (patch: Partial<GridConnection>) => setH({ grid: { ...h.grid, ...patch } });
  const setWarranty = (id: string, patch: Partial<WarrantyItem>) => setH({ warranties: h.warranties.map((w) => (w.id === id ? { ...w, ...patch } : w)) });
  const newId = () => Math.random().toString(36).slice(2, 10);
  const fillWarranties = () =>
    setH({
      warranties: suggestedWarranties({
        panelName: `${project.pv.panel.brand} ${project.pv.panel.model}`.trim(),
        panels: results.strings.totalPanels,
        inverterName: `${results.inverter.spec.brand ?? ""} ${results.inverter.spec.model || `${fmt(results.inverter.ratedPowerW / 1000, 1)} kW inverter`}`.trim(),
        batteryName: `${project.battery.brand} ${project.battery.model || `${project.battery.unitVoltage} V ${project.battery.unitAh} Ah`}`.trim(),
        batteryUnits: results.battery.totalUnits,
        batteryChemistry: project.battery.chemistry,
        controllerName: `${project.controller.brand} ${project.controller.model}`.trim() || "MPPT charge controller",
        controllers: results.controller.applicable ? results.controller.count : 0,
      }).map((w) => ({ ...w, id: newId() })),
    });
  const plan = maintenancePlan({ battery: project.battery, batteryLifeYears: results.financial.batteryLifeYears, inverterLifeYears: project.financial.inverterLifeYears || 10, hasController: results.controller.applicable, ground: results.structure.mount === "ground" });
  const passed = C.strings.filter((s) => [s.voc, s.isc, s.polarity, s.insulation].every((x) => x === "pass")).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Strings fully passed" value={`${passed} / ${C.strings.length}`} tone={passed === C.strings.length && C.strings.length > 0 ? "good" : undefined} />
        <Stat label="Earth electrode" value={h.earthOhm > 0 ? `${fmt(h.earthOhm, 1)} Ω` : "–"} tone={C.earth === "pass" ? "good" : C.earth === "fail" ? "bad" : undefined} hint={`Target ≤ ${C.earthTargetOhm} Ω`} />
        <Stat label="RCD trip time" value={h.rcdTripMs > 0 ? `${fmt(h.rcdTripMs)} ms` : "–"} tone={C.rcd === "pass" ? "good" : C.rcd === "fail" ? "bad" : undefined} hint={`≤ ${RCD_MAX_MS} ms at IΔn`} />
        <Stat label="Functional tests" value={`${C.functionalDone} / ${C.functionalTotal}`} tone={C.functionalDone === C.functionalTotal ? "good" : undefined} />
      </div>

      <Card
        title="String tests (IEC 62446-1)"
        subtitle={`Voc must be within ±${VOC_TOLERANCE_PCT} % of the datasheet value corrected to the module temperature; Isc within ±${ISC_TOLERANCE_PCT} % after scaling to the measured irradiance. Insulation: test at ${C.insulationTestV} V, minimum ${C.insulationMinMOhm} MΩ.`}
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="table min-w-[1320px]">
            <thead>
              <tr>
                <th>String</th>
                <th className="w-36">Voc measured</th>
                <th className="w-32">Module temp.</th>
                <th className="text-right">Voc expected</th>
                <th className="w-32">Isc measured</th>
                <th className="w-40">Irradiance</th>
                <th className="text-right">Isc expected</th>
                <th className="text-center">Polarity</th>
                <th className="w-36">Insulation</th>
                <th className="text-center">Result</th>
              </tr>
            </thead>
            <tbody>
              {C.strings.map((s) => (
                <tr key={s.key}>
                  <td className="font-semibold">{s.key}</td>
                  <td>
                    <NumInput value={s.test.vocV} min={0} onChange={(vocV) => setString(s.key, { vocV })} suffix="V" />
                  </td>
                  <td>
                    <NumInput value={s.test.cellTempC} min={-20} max={100} onChange={(cellTempC) => setString(s.key, { cellTempC })} suffix="°C" />
                  </td>
                  <td className="num text-right">
                    {fmt(s.expectedVocV, 1)} V<div className={cx("text-[11px]", s.voc === "fail" ? "text-bad" : "text-muted")}>{dev(s.vocDevPct)}</div>
                  </td>
                  <td>
                    <NumInput value={s.test.iscA} min={0} step={0.01} onChange={(iscA) => setString(s.key, { iscA })} suffix="A" />
                  </td>
                  <td>
                    <NumInput value={s.test.irradianceWm2} min={0} max={1500} onChange={(irradianceWm2) => setString(s.key, { irradianceWm2 })} suffix="W/m²" />
                  </td>
                  <td className="num text-right">
                    {fmt(s.expectedIscA, 2)} A<div className={cx("text-[11px]", s.isc === "fail" ? "text-bad" : "text-muted")}>{dev(s.iscDevPct)}</div>
                  </td>
                  <td className="text-center">
                    <input type="checkbox" className="h-4 w-4 accent-[var(--good)]" checked={s.test.polarityOk} onChange={(e) => setString(s.key, { polarityOk: e.target.checked })} aria-label={`${s.key} polarity correct`} />
                  </td>
                  <td>
                    <NumInput value={s.test.insulationMOhm} min={0} step={0.1} onChange={(insulationMOhm) => setString(s.key, { insulationMOhm })} suffix="MΩ" />
                  </td>
                  <td className="text-center">
                    <div className="flex flex-col items-center gap-0.5 text-[10px] text-muted">
                      <span>
                        Voc <ResultPill status={s.voc} />
                      </span>
                      <span>
                        Isc <ResultPill status={s.isc} />
                      </span>
                      <span>
                        Ins <ResultPill status={s.insulation} />
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-3 text-xs text-muted">Measure Voc with the string isolated and Isc with a clamp meter or PV tester at steady irradiance (ideally above 400 W/m²). Enter the module back-of-panel temperature for the Voc reading.</p>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="AC side and earthing">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Earth electrode resistance" hint={`Target ≤ ${C.earthTargetOhm} Ω`}>
              <NumInput value={h.earthOhm} min={0} step={0.1} onChange={(earthOhm) => setH({ earthOhm })} suffix="Ω" />
            </Field>
            <Field label="RCD trip time at IΔn" hint={`≤ ${RCD_MAX_MS} ms`}>
              <NumInput value={h.rcdTripMs} min={0} onChange={(rcdTripMs) => setH({ rcdTripMs })} suffix="ms" />
            </Field>
            <Field label="AC output voltage">
              <NumInput value={h.acVoltageV} min={0} onChange={(acVoltageV) => setH({ acVoltageV })} suffix="V" />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Tested by">
              <input className="input" value={h.testedBy} onChange={(e) => setH({ testedBy: e.target.value })} />
            </Field>
            <Field label="Test date">
              <input className="input" type="date" value={h.testDate} onChange={(e) => setH({ testDate: e.target.value })} />
            </Field>
            <Field label="Test instrument / serial">
              <input className="input" value={h.instrument} onChange={(e) => setH({ instrument: e.target.value })} />
            </Field>
          </div>
        </Card>
        <Card title="Functional tests" className="h-fit">
          <ul className="space-y-2">
            {FUNCTIONAL_TESTS.filter((f) => !f.gridOnly || grid).map((f) => (
              <li key={f.key}>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--good)]" checked={Boolean(h.functional[f.key])} onChange={(e) => setH({ functional: { ...h.functional, [f.key]: e.target.checked } })} />
                  {f.label}
                </label>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Grid connection" subtitle={grid ? "What must be in place before the system runs alongside the utility supply" : "No grid at this site (set in Project & Site)"}>
        {grid ? (
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-4">
              <Field label="How the grid is used">
                <Select
                  value={h.grid.connection}
                  onChange={(connection) => setGrid({ connection })}
                  options={[
                    { value: "backup", label: "Backup and battery charging only (no export)" },
                    { value: "export", label: "Exporting surplus to the grid" },
                    { value: "none", label: "Not connected to the grid" },
                  ]}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Distribution company (DisCo)">
                  <input className="input" value={h.grid.disco} onChange={(e) => setGrid({ disco: e.target.value })} placeholder="e.g. Ikeja Electric" />
                </Field>
                <Field label="Account number">
                  <input className="input" value={h.grid.accountNumber} onChange={(e) => setGrid({ accountNumber: e.target.value })} />
                </Field>
                <Field label="Meter number">
                  <input className="input" value={h.grid.meterNumber} onChange={(e) => setGrid({ meterNumber: e.target.value })} />
                </Field>
                <Field label="Application / approval reference">
                  <input className="input" value={h.grid.applicationRef} onChange={(e) => setGrid({ applicationRef: e.target.value })} />
                </Field>
                {h.grid.connection === "export" && (
                  <Field label="Approved export limit">
                    <NumInput value={h.grid.exportLimitW} min={0} onChange={(exportLimitW) => setGrid({ exportLimitW })} suffix="W" />
                  </Field>
                )}
              </div>
              {G.steps.length > 0 && (
                <ul className="space-y-2">
                  {G.steps.map((st) => (
                    <li key={st.key}>
                      <label className="flex items-start gap-2 text-sm">
                        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--good)]" checked={Boolean(h.grid.steps[st.key])} onChange={(e) => setGrid({ steps: { ...h.grid.steps, [st.key]: e.target.checked } })} />
                        {st.label}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {h.grid.connection === "export" ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Typical inverter protection settings (230 V / 50 Hz)</h3>
                <KeyValue rows={GRID_SETTINGS} />
                <p className="mt-2 text-[11px] text-muted">Starting values only. Use the settings your DisCo specifies in its approval; they take precedence.</p>
              </div>
            ) : (
              <p className="text-sm text-muted">
                In backup mode the inverter charges from the grid and takes over the essential loads when it fails, but must never feed power back into the grid. Set zero export on the inverter and check it with the grid switched off at the meter.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">Off-grid system: no utility connection paperwork is needed.</p>
        )}
      </Card>

      <Card
        title="Warranty register"
        subtitle="Serial numbers and warranty periods for the client's records"
        actions={
          <div className="flex gap-2">
            <button type="button" className="btn btn-sm" onClick={() => (!h.warranties.length || confirm("Replace the register with items from the design?")) && fillWarranties()}>
              Fill from design
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setH({ warranties: [...h.warranties, { id: newId(), item: "Equipment", make: "", model: "", serial: "", quantity: 1, warrantyYears: 1 }] })}>
              + Item
            </button>
          </div>
        }
        bodyClassName="p-0"
      >
        {h.warranties.length === 0 ? (
          <p className="p-5 text-sm text-muted">No items yet. Use “Fill from design” to list the modules, inverter, batteries and controller, then add their serial numbers.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[920px]">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Make / model</th>
                  <th className="w-56">Serial number(s)</th>
                  <th className="w-24">Qty</th>
                  <th className="w-28">Warranty</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {h.warranties.map((w) => (
                  <tr key={w.id}>
                    <td>
                      <input className="input py-1.5" value={w.item} onChange={(e) => setWarranty(w.id, { item: e.target.value })} aria-label="Item" />
                    </td>
                    <td>
                      <input className="input py-1.5" value={w.model} onChange={(e) => setWarranty(w.id, { model: e.target.value })} aria-label="Make and model" />
                    </td>
                    <td>
                      <input className="input py-1.5" value={w.serial} onChange={(e) => setWarranty(w.id, { serial: e.target.value })} placeholder="Serials, comma-separated" aria-label="Serial numbers" />
                    </td>
                    <td>
                      <NumInput value={w.quantity} min={0} onChange={(quantity) => setWarranty(w.id, { quantity })} />
                    </td>
                    <td>
                      <NumInput value={w.warrantyYears} min={0} max={50} onChange={(warrantyYears) => setWarranty(w.id, { warrantyYears })} suffix="yr" />
                    </td>
                    <td>
                      <button type="button" className="btn btn-sm text-bad" onClick={() => setH({ warranties: h.warranties.filter((x) => x.id !== w.id) })} aria-label="Remove item">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Operation & maintenance plan" subtitle="Hand this to the client with the system">
          <ul className="divide-y divide-line text-sm">
            {plan.map((t, i) => (
              <li key={i} className="flex gap-3 py-2">
                <span className="w-36 shrink-0 text-xs font-semibold text-muted">{t.interval}</span>
                <span className="min-w-0 flex-1">{t.task}</span>
                <span className="shrink-0 text-[11px] text-muted">{t.by}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Handover" className="h-fit">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Handover date">
              <input className="input" type="date" value={h.handoverDate} onChange={(e) => setH({ handoverDate: e.target.value })} />
            </Field>
            <Field label="Received by (client)">
              <input className="input" value={h.receivedBy} onChange={(e) => setH({ receivedBy: e.target.value })} />
            </Field>
            <Field label="Notes (as-built changes, spare parts left, training given)" className="sm:col-span-2">
              <textarea className="input min-h-24" value={h.notes} onChange={(e) => setH({ notes: e.target.value })} />
            </Field>
          </div>
          <p className="mt-3 text-xs text-muted">Record any change from the design (cable routes, equipment substitutions, extra strings) in the notes so the report doubles as the as-built record.</p>
        </Card>
      </div>
    </div>
  );
}

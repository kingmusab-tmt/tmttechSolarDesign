"use client";

import { CHEMISTRY_INFO } from "@/lib/calc/constants";
import { fmt } from "@/lib/format";
import { BATTERY_CHEMISTRIES, type BatterySettings } from "@/lib/schemas";
import { Card, Field, Formula, NumInput, Select, Stat, TextInput } from "../ui";
import { useProject } from "../project/ProjectProvider";
import { EquipmentPicker, numericSpecs, useSection } from "./shared";
import { YearSimCard } from "./YearSimCard";

export function BatteryStep() {
  const { results, project } = useProject();
  const [bat, setBat] = useSection("battery");
  const R = results.battery;
  const V = results.inverter.systemVoltage;
  const chem = CHEMISTRY_INFO[bat.chemistry];

  const setChemistry = (chemistry: BatterySettings["chemistry"]) => {
    const c = CHEMISTRY_INFO[chemistry];
    setBat({ chemistry, dod: c.dod, maxChargeCRate: c.maxChargeC, maxDischargeCRate: c.maxDischargeC, unitVoltage: chemistry === "lifepo4" ? bat.unitVoltage : 12 });
  };

  const maxCols = 8;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Required capacity" value={fmt(R.requiredAh)} unit={`Ah @ ${V} V`} hint={`${fmt(R.requiredWh / 1000, 2)} kWh nominal`} />
        <Stat label="Battery bank" value={`${R.seriesCount}S × ${R.parallelCount}P`} hint={`${R.totalUnits} × ${bat.unitVoltage} V ${bat.unitAh} Ah`} tone="accent" />
        <Stat label="Installed / usable energy" value={`${fmt(R.bankKWh, 1)} / ${fmt(R.usableKWh, 1)}`} unit="kWh" hint={`At ${fmt(bat.dod * 100)} % DoD`} />
        <Stat label="Actual autonomy" value={fmt(R.actualAutonomyDays, 2)} unit="days" hint={`Target ${bat.daysOfAutonomy} day(s)`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Battery parameters">
          <EquipmentPicker
            type="battery"
            onApply={(item) => {
              const chemistry = (BATTERY_CHEMISTRIES as readonly string[]).includes(String(item.specs.chemistry)) ? (item.specs.chemistry as BatterySettings["chemistry"]) : bat.chemistry;
              setBat({ ...numericSpecs(item.specs), chemistry, brand: item.brand, model: item.model });
            }}
          />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Chemistry" className="sm:col-span-2" hint={`${chem.label}: recommended DoD ≤ ${chem.dod * 100} %, typical life about ${chem.lifeYears} years (${fmt(chem.cycleLife)} cycles)`}>
              <Select value={bat.chemistry} onChange={setChemistry} options={BATTERY_CHEMISTRIES.map((c) => ({ value: c, label: CHEMISTRY_INFO[c].label }))} />
            </Field>
            <Field label="Depth of discharge (DoD)" hint="Lead-acid / gel 0.5 · LiFePO4 0.8–0.95">
              <NumInput value={bat.dod} min={0.1} max={1} step={0.05} onChange={(dod) => setBat({ dod })} />
            </Field>
            <Field label="Days of autonomy" hint="Cloudy days covered with no solar input">
              <NumInput value={bat.daysOfAutonomy} min={0.1} max={10} step={0.5} onChange={(daysOfAutonomy) => setBat({ daysOfAutonomy })} suffix="days" />
            </Field>
            <Field label="Brand">
              <TextInput value={bat.brand} onChange={(brand) => setBat({ brand })} />
            </Field>
            <Field label="Model">
              <TextInput value={bat.model} onChange={(model) => setBat({ model })} />
            </Field>
            <Field label="Unit nominal voltage">
              <NumInput value={bat.unitVoltage} min={1} onChange={(unitVoltage) => setBat({ unitVoltage })} suffix="V" />
            </Field>
            <Field label="Unit capacity">
              <NumInput value={bat.unitAh} min={1} onChange={(unitAh) => setBat({ unitAh })} suffix="Ah" />
            </Field>
            <Field label="Max charge rate">
              <NumInput value={bat.maxChargeCRate} min={0.01} max={5} step={0.05} onChange={(maxChargeCRate) => setBat({ maxChargeCRate })} suffix="C" />
            </Field>
            <Field label="Max discharge rate">
              <NumInput value={bat.maxDischargeCRate} min={0.01} max={5} step={0.05} onChange={(maxDischargeCRate) => setBat({ maxDischargeCRate })} suffix="C" />
            </Field>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Calculation">
            <div className="space-y-3">
              <Formula
                title="Battery capacity"
                expr="Ah = (E_daily × days) / (V × DoD × η_inv)"
                sub={`= (${fmt(results.load.dailyWh)} × ${bat.daysOfAutonomy}) / (${V} × ${bat.dod} × ${project.inverter.efficiency})`}
                result={`= ${fmt(R.requiredAh, 1)} Ah`}
              />
              <Formula title="Series" expr="N_s = V_system / V_unit" sub={`= ${V} / ${bat.unitVoltage}`} result={`= ${R.seriesCount} in series (${fmt(R.bankVoltage, 1)} V)`} />
              <Formula title="Parallel" expr="N_p = ⌈Ah_required / Ah_unit⌉" sub={`= ⌈${fmt(R.requiredAh, 1)} / ${bat.unitAh}⌉`} result={`= ${R.parallelCount} string(s), ${fmt(R.bankAh)} Ah bank`} />
              <Formula title="C-rates" expr={`Discharge ${fmt(R.maxDischargeA)} A = ${fmt(R.dischargeC, 2)}C · Charge ${fmt(R.chargeCurrentA)} A = ${fmt(R.chargeC, 2)}C`} />
            </div>
          </Card>
          <Card title="Bank arrangement" subtitle={`${R.seriesCount} in series × ${R.parallelCount} in parallel`}>
            <div className="space-y-2 overflow-x-auto">
              {Array.from({ length: Math.min(R.parallelCount, 6) }).map((_, p) => (
                <div key={p} className="flex items-center gap-1">
                  <span className="w-8 text-[10px] text-muted">P{p + 1}</span>
                  {Array.from({ length: Math.min(R.seriesCount, maxCols) }).map((__, s) => (
                    <div key={s} className="flex items-center gap-1">
                      <div className="flex h-9 w-14 flex-col items-center justify-center rounded-md border border-line bg-surface-2 text-[9px] leading-tight">
                        <span className="font-semibold">{bat.unitVoltage} V</span>
                        <span className="text-muted">{bat.unitAh} Ah</span>
                      </div>
                      {s < Math.min(R.seriesCount, maxCols) - 1 && <span className="text-muted">–</span>}
                    </div>
                  ))}
                  {R.seriesCount > maxCols && <span className="text-xs text-muted">… +{R.seriesCount - maxCols}</span>}
                </div>
              ))}
              {R.parallelCount > 6 && <div className="text-xs text-muted">… and {R.parallelCount - 6} more parallel strings</div>}
            </div>
          </Card>
        </div>
      </div>
      {results.load.dailyWh > 0 && <YearSimCard sim={results.simulation} />}
    </div>
  );
}

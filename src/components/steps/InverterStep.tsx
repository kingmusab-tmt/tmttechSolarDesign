"use client";

import { fmt } from "@/lib/format";
import type { InverterSpec } from "@/lib/schemas";
import { Card, Field, Formula, NumInput, Select, Stat, TextInput } from "../ui";
import { useProject } from "../project/ProjectProvider";
import { EquipmentPicker, numericSpecs, useSection } from "./shared";

export function InverterStep() {
  const { results } = useProject();
  const [inv, setInv] = useSection("inverter");
  const R = results.inverter;
  const L = results.load;
  // Until a model is chosen the generic spec is in effect; editing any field adopts it as the starting point.
  const spec = R.isSelected ? inv.selected : R.spec;
  const setSpec = (patch: Partial<InverterSpec>) => setInv({ selected: { ...spec, ...patch } });
  const hybrid = inv.type === "hybrid";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Required continuous rating" value={fmt(R.requiredContinuousW)} unit="W" hint={`${fmt(L.continuousW)} W × ${inv.margin}`} />
        <Stat label="Required surge rating" value={fmt(R.requiredSurgeW)} unit="W" />
        <Stat label="Recommended standard size" value={fmt(R.recommendedSizeW / 1000, 1)} unit="kW" tone="accent" hint={R.sizedForPv ? `Raised so the built-in MPPT accepts the ${fmt(results.pv.requiredPvW)} Wp array` : "Next standard size above the requirement"} />
        <Stat label="System DC voltage" value={R.systemVoltage} unit="V" hint={inv.systemVoltage ? "Manually selected" : `Auto (${R.autoVoltage} V recommended)`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Design parameters">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Inverter type" className="sm:col-span-2" hint="A hybrid inverter has a built-in MPPT charge controller and can also take grid/generator input.">
              <Select
                value={inv.type}
                onChange={(type) => setInv({ type })}
                options={[
                  { value: "hybrid", label: "Hybrid inverter (built-in MPPT)" },
                  { value: "standalone", label: "Standalone inverter + separate charge controller" },
                ]}
              />
            </Field>
            <Field label="Safety margin" hint="At least 1.25 (25 %) above the continuous load">
              <NumInput value={inv.margin} min={1} max={3} step={0.05} onChange={(margin) => setInv({ margin })} suffix="×" />
            </Field>
            <Field label="Inverter efficiency" hint="Typically 0.90–0.95">
              <NumInput value={inv.efficiency} min={0.5} max={1} step={0.01} onChange={(efficiency) => setInv({ efficiency })} />
            </Field>
            <Field label="System (battery) voltage" className="sm:col-span-2" hint="≤ 1.5 kW → 12 V, ≤ 3 kW → 24 V, larger → 48 V. Higher voltage keeps DC currents and cables manageable.">
              <Select
                value={inv.systemVoltage}
                onChange={(systemVoltage) => setInv({ systemVoltage })}
                options={[
                  { value: 0, label: `Auto (${R.autoVoltage} V)` },
                  { value: 12, label: "12 V" },
                  { value: 24, label: "24 V" },
                  { value: 48, label: "48 V" },
                ]}
              />
            </Field>
          </div>
        </Card>

        <Card title="Calculation">
          <div className="space-y-3">
            <Formula title="Continuous rating" expr="P_inv ≥ P_continuous × margin" sub={`= ${fmt(L.continuousW)} × ${inv.margin}`} result={`= ${fmt(R.requiredContinuousW)} W → standard size ${fmt(R.recommendedSizeW)} W${R.sizedForPv ? " (raised for PV input)" : ""}`} />
            <Formula title="Surge rating" expr="P_surge ≥ P_continuous + largest motor × (surge − 1)" result={`≥ ${fmt(R.requiredSurgeW)} W`} />
            <Formula title="Selected inverter" expr={`${fmt(R.ratedPowerW)} W continuous / ${fmt(R.surgePowerW)} W surge`} result={`Loading at design load: ${fmt(R.loadingPct, 0)} %`} />
          </div>
        </Card>
      </div>

      <Card
        title="Selected inverter"
        subtitle={R.isSelected ? "Datasheet values of the chosen model. Set the rated power to 0 to return to the automatic generic size." : `No model selected: a generic ${fmt(R.ratedPowerW / 1000, 1)} kW / ${R.systemVoltage} V hybrid is assumed. Pick a model or edit any value to customise.`}
        actions={
          R.isSelected ? (
            <button className="btn btn-sm" onClick={() => setInv({ selected: { ...inv.selected, ratedPowerW: 0 } })}>
              Use automatic size
            </button>
          ) : undefined
        }
      >
        <EquipmentPicker
          type="inverter"
          onApply={(item) => {
            const { batteryVoltage, ...values } = numericSpecs(item.specs);
            // Inverter/chargers without a built-in MPPT need a separate charge controller.
            const type = item.specs.kind === "inverter_charger" ? "standalone" : "hybrid";
            const systemVoltage = batteryVoltage === 12 || batteryVoltage === 24 || batteryVoltage === 48 ? batteryVoltage : inv.systemVoltage;
            setInv({ type, systemVoltage, selected: { ...spec, ...values, brand: item.brand, model: item.model } });
          }}
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Brand">
            <TextInput value={spec.brand} onChange={(brand) => setSpec({ brand })} />
          </Field>
          <Field label="Model">
            <TextInput value={spec.model} onChange={(model) => setSpec({ model })} />
          </Field>
          <Field label="Rated continuous power">
            <NumInput value={spec.ratedPowerW} min={0} onChange={(ratedPowerW) => setSpec({ ratedPowerW })} suffix="W" />
          </Field>
          <Field label="Surge / peak power" hint="0 = assume 2 × rated">
            <NumInput value={spec.surgePowerW} min={0} onChange={(surgePowerW) => setSpec({ surgePowerW })} suffix="W" />
          </Field>
          {hybrid && (
            <>
              <Field label="Max PV input voltage (Voc)">
                <NumInput value={spec.maxPvVoltage} min={0} onChange={(maxPvVoltage) => setSpec({ maxPvVoltage })} suffix="V" />
              </Field>
              <Field label="MPPT range: minimum">
                <NumInput value={spec.mpptMinV} min={0} onChange={(mpptMinV) => setSpec({ mpptMinV })} suffix="V" />
              </Field>
              <Field label="MPPT range: maximum">
                <NumInput value={spec.mpptMaxV} min={0} onChange={(mpptMaxV) => setSpec({ mpptMaxV })} suffix="V" />
              </Field>
              <Field label="Max PV array power">
                <NumInput value={spec.maxPvPowerW} min={0} onChange={(maxPvPowerW) => setSpec({ maxPvPowerW })} suffix="W" />
              </Field>
              <Field label="Max input current per MPPT">
                <NumInput value={spec.maxPvInputCurrentA} min={0} onChange={(maxPvInputCurrentA) => setSpec({ maxPvInputCurrentA })} suffix="A" />
              </Field>
              <Field label="Max short-circuit current per MPPT">
                <NumInput value={spec.maxPvIscA} min={0} onChange={(maxPvIscA) => setSpec({ maxPvIscA })} suffix="A" />
              </Field>
              <Field label="Number of MPPTs">
                <NumInput value={spec.mpptCount} min={1} max={12} step={1} onChange={(mpptCount) => setSpec({ mpptCount })} />
              </Field>
              <Field label="Max solar charge current">
                <NumInput value={spec.maxChargeCurrentA} min={0} onChange={(maxChargeCurrentA) => setSpec({ maxChargeCurrentA })} suffix="A" />
              </Field>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

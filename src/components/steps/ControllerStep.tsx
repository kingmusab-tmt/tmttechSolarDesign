"use client";

import { fmt } from "@/lib/format";
import { Card, Field, Formula, NumInput, Stat, TextInput } from "../ui";
import { useProject } from "../project/ProjectProvider";
import { EquipmentPicker, numericSpecs, useSection } from "./shared";

export function ControllerStep() {
  const { results, project } = useProject();
  const [ctrl, setCtrl] = useSection("controller");
  const [, setInv] = useSection("inverter");
  const C = results.controller;
  const V = results.inverter.systemVoltage;
  const arrayW = results.strings.arrayW;

  if (!C.applicable)
    return (
      <div className="space-y-6">
        <Card title="Built-in MPPT charge controller">
          <p className="text-sm text-muted">
            This design uses a <strong className="text-text">hybrid inverter</strong>, which has a built-in MPPT charge controller, so no standalone controller is needed. Its PV input limits are checked in String Sizing, and its charge current is checked below.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Stat label="PV charge current available" value={fmt(C.hybridChargeA)} unit="A" hint={`${fmt(arrayW)} W ÷ ${V} V`} />
            <Stat label="Inverter max charge current" value={fmt(results.inverter.spec.maxChargeCurrentA)} unit="A" tone={results.inverter.spec.maxChargeCurrentA >= C.hybridChargeA ? "good" : "warn"} />
          </div>
          <button className="btn mt-5" onClick={() => setInv({ type: "standalone" })}>
            Switch to standalone inverter + charge controller
          </button>
        </Card>
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Required rating" value={fmt(C.requiredA, 1)} unit="A" />
        <Stat label="Recommended size" value={C.recommendedA} unit="A" tone="accent" />
        <Stat label="Controllers needed" value={C.count} hint={`${C.count} × ${C.ratedA} A`} />
        <Stat label="Battery voltage" value={V} unit="V" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Calculation">
          <div className="space-y-3">
            <Formula title="Controller current" expr="I = (P_pv / V_battery) × margin" sub={`= (${fmt(arrayW)} / ${V}) × ${ctrl.margin}`} result={`= ${fmt(C.requiredA, 1)} A`} />
            <Field label="Safety margin" hint="1.25 covers bright, cold days when panels over-produce">
              <NumInput value={ctrl.margin} min={1} max={3} step={0.05} onChange={(margin) => setCtrl({ margin })} suffix="×" />
            </Field>
          </div>
        </Card>
        <Card title="Selected MPPT charge controller" subtitle="Leave the rating at 0 to use the recommended size">
          <EquipmentPicker type="controller" onApply={(item) => setCtrl({ ...numericSpecs(item.specs), brand: item.brand, model: item.model })} />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Brand">
              <TextInput value={ctrl.brand} onChange={(brand) => setCtrl({ brand })} />
            </Field>
            <Field label="Model">
              <TextInput value={ctrl.model} onChange={(model) => setCtrl({ model })} />
            </Field>
            <Field label="Rated output current">
              <NumInput value={ctrl.ratedCurrentA} min={0} onChange={(ratedCurrentA) => setCtrl({ ratedCurrentA })} suffix="A" />
            </Field>
            <Field label="Max PV input voltage" hint="Used for string sizing">
              <NumInput value={ctrl.maxPvVoltage} min={0} onChange={(maxPvVoltage) => setCtrl({ maxPvVoltage })} suffix="V" />
            </Field>
            <Field label={`Max PV power (at ${V} V)`} hint="0 = not checked">
              <NumInput value={ctrl.maxPvPowerW} min={0} onChange={(maxPvPowerW) => setCtrl({ maxPvPowerW })} suffix="W" />
            </Field>
          </div>
        </Card>
      </div>
    </div>
  );
}

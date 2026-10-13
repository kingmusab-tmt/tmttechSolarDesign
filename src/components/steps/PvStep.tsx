"use client";

import Link from "next/link";
import { useState } from "react";
import type { CecModule } from "@/lib/cec";
import { fmt } from "@/lib/format";
import type { PanelSpec } from "@/lib/schemas";
import { CecModuleSearch } from "../CecModuleSearch";
import { Card, Field, Formula, NumInput, Stat, TextInput } from "../ui";
import { useProject } from "../project/ProjectProvider";
import { EquipmentPicker, numericSpecs, useSection } from "./shared";

export function PanelSpecFields({ panel, onChange }: { panel: PanelSpec; onChange: (p: Partial<PanelSpec>) => void }) {
  const f: [keyof PanelSpec, string, string][] = [
    ["pmaxW", "Pmax (STC)", "W"],
    ["vocV", "Voc", "V"],
    ["vmpV", "Vmp", "V"],
    ["iscA", "Isc", "A"],
    ["impA", "Imp", "A"],
    ["betaVocPct", "Temp. coeff. of Voc (β)", "%/°C"],
    ["gammaPmaxPct", "Temp. coeff. of Pmax (γ)", "%/°C"],
    ["noctC", "NOCT", "°C"],
    ["lengthM", "Length", "m"],
    ["widthM", "Width", "m"],
    ["weightKg", "Weight", "kg"],
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Brand">
        <TextInput value={panel.brand} onChange={(brand) => onChange({ brand })} />
      </Field>
      <Field label="Model">
        <TextInput value={panel.model} onChange={(model) => onChange({ model })} />
      </Field>
      {f.map(([k, label, unit]) => (
        <Field key={k} label={label}>
          <NumInput value={panel[k] as number} onChange={(v) => onChange({ [k]: v } as Partial<PanelSpec>)} suffix={unit} />
        </Field>
      ))}
    </div>
  );
}

export function PvStep() {
  const { results, project } = useProject();
  const [pv, setPv] = useSection("pv");
  const P = results.pv;
  const S = results.strings;
  const psh = project.site.peakSunHours;
  const [showCec, setShowCec] = useState(false);
  const [cecNote, setCecNote] = useState("");
  const applyCecModule = (m: CecModule) => {
    setPv({ panel: { ...pv.panel, ...m.specs, brand: m.manufacturer, model: m.model } });
    setCecNote(`${m.manufacturer} ${m.model} applied from the CEC database. Weight (${m.specs.weightKg} kg) is estimated${m.dimsEstimated ? " and dimensions are derived from the module area" : ""}: confirm both from the manufacturer datasheet for the structural check and roof layout.`);
    setShowCec(false);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Required PV power" value={fmt(P.requiredPvW)} unit="Wp" hint={`${P.panelsRequired} × ${pv.panel.pmaxW} W panels minimum`} />
        <Stat label="Installed array" value={fmt(S.arrayW / 1000, 2)} unit="kWp" tone="accent" hint={`${S.totalPanels} panels (${S.series} in series × ${S.parallel} strings)`} />
        <Stat label="Expected daily yield" value={fmt(P.dailyYieldKWh, 2)} unit="kWh/day" hint={`${fmt(P.annualYieldKWh)} kWh/year`} />
        <Stat label="Solar coverage" value={fmt(P.solarFraction * 100)} unit="%" tone={P.solarFraction >= 1 ? "good" : "warn"} hint="Daily yield ÷ daily demand" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Losses">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="System efficiency" hint="Covers heat, dust, wiring, mismatch and MPPT losses (usually 0.70–0.80)">
              <NumInput value={pv.systemEfficiency} min={0.4} max={1} step={0.01} onChange={(systemEfficiency) => setPv({ systemEfficiency })} />
            </Field>
            <Field
              label="Shading loss"
              hint={
                <>
                  Set in the{" "}
                  <Link className="underline" href={`/projects/${project._id}/assessment`}>
                    site assessment
                  </Link>
                </>
              }
            >
              <div className="input bg-surface-2">{project.assessment.shadingLossPct} %</div>
            </Field>
            <Field label="Peak sun hours" hint="Set on the Project & Site step">
              <div className="input bg-surface-2">{psh} h/day</div>
            </Field>
          </div>
        </Card>
        <Card title="Calculation">
          <div className="space-y-3">
            <Formula title="Required daily generation" expr="E_gen = E_daily / (η_sys × (1 − shading))" sub={`= ${fmt(results.load.dailyWh)} / (${pv.systemEfficiency} × ${fmt(P.shadingFactor, 2)})`} result={`= ${fmt(P.requiredGenerationWh)} Wh/day`} />
            <Formula title="PV array power" expr="P_pv = E_gen / PSH" sub={`= ${fmt(P.requiredGenerationWh)} / ${psh}`} result={`= ${fmt(P.requiredPvW)} Wp`} />
            <Formula title="Number of panels" expr="N = ⌈P_pv / P_panel⌉" sub={`= ⌈${fmt(P.requiredPvW)} / ${pv.panel.pmaxW}⌉`} result={`= ${P.panelsRequired} panels → ${S.totalPanels} after string sizing`} />
          </div>
        </Card>
      </div>

      <Card title="PV module datasheet" subtitle="The temperature coefficients and dimensions feed string sizing, the roof layout and the structural check">
        <EquipmentPicker type="panel" onApply={(item) => setPv({ panel: { ...pv.panel, ...numericSpecs(item.specs), brand: item.brand, model: item.model } })} />
        <div className="mt-3">
          <button className="btn btn-sm" onClick={() => setShowCec((v) => !v)}>
            {showCec ? "Hide CEC search" : "Search 21,677 real modules (CEC database)"}
          </button>
        </div>
        {showCec && (
          <div className="mt-4 rounded-xl border border-line p-4">
            <CecModuleSearch actionLabel="Use in design" onSelect={applyCecModule} />
          </div>
        )}
        {cecNote && <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">{cecNote}</p>}
        <div className="mt-5">
          <PanelSpecFields panel={pv.panel} onChange={(patch) => setPv({ panel: { ...pv.panel, ...patch } })} />
        </div>
      </Card>
    </div>
  );
}

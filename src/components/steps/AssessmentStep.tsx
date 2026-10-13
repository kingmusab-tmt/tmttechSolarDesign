"use client";

import { fmt } from "@/lib/format";
import { COMPASS, type Obstruction } from "@/lib/schemas";
import { Badge, Card, Field, KeyValue, NumInput, Select, Stat } from "../ui";
import { useProject } from "../project/ProjectProvider";
import { useSection } from "./shared";

export function AssessmentStep() {
  const { results } = useProject();
  const [a, setA] = useSection("assessment");
  const S = results.site;
  const setObs = (id: string, patch: Partial<Obstruction>) => setA({ obstructions: a.obstructions.map((o) => (o.id === id ? { ...o, ...patch } : o)) });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Array dead load" value={fmt(S.deadLoadKgM2, 1)} unit="kg/m²" tone={S.deadLoadKgM2 <= a.roofAllowableLoadKgM2 ? "good" : "bad"} hint={`Allowable ${a.roofAllowableLoadKgM2} kg/m²`} />
        <Stat label="Total array weight" value={fmt(S.arrayWeightKg)} unit="kg" hint={`${fmt(results.layout.arrayAreaM2, 1)} m² of modules`} />
        <Stat label="Orientation deviation" value={fmt(S.azimuthDeviationDeg)} unit="°" tone={S.azimuthDeviationDeg <= 45 ? "good" : "warn"} hint={`Ideal azimuth ${S.recommendedAzimuthDeg}°`} />
        <Stat label="Shading loss applied" value={a.shadingLossPct} unit="%" hint="Feeds PV array sizing" />
      </div>

      <Card
        title="Shading & solar access"
        subtitle="Record obstructions measured with a Solar Pathfinder, a digital model or on-site observation. Objects above about 15° in the sun's path cause significant losses."
        actions={
          <button className="btn btn-sm" onClick={() => setA({ obstructions: [...a.obstructions, { id: Math.random().toString(36).slice(2, 10), description: "Tree", direction: "S", heightM: 6, distanceM: 10 }] })}>
            + Add obstruction
          </button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Assessment method">
            <Select
              value={a.shadingMethod}
              onChange={(shadingMethod) => setA({ shadingMethod })}
              options={[
                { value: "solar_pathfinder", label: "Solar Pathfinder" },
                { value: "digital_model", label: "Digital 3D model" },
                { value: "visual", label: "Visual / clinometer survey" },
              ]}
            />
          </Field>
          <Field label="Annual shading loss" hint="From the shading analysis; increases the required PV size">
            <NumInput value={a.shadingLossPct} min={0} max={80} onChange={(shadingLossPct) => setA({ shadingLossPct })} suffix="%" />
          </Field>
        </div>
        {a.obstructions.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="table min-w-[720px]">
              <thead>
                <tr>
                  <th>Obstruction</th>
                  <th className="w-24">Direction</th>
                  <th className="w-28">Height above array</th>
                  <th className="w-28">Distance</th>
                  <th className="text-right">Elevation angle</th>
                  <th>Impact</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {a.obstructions.map((o) => {
                  const r = S.obstructions.find((x) => x.id === o.id);
                  return (
                    <tr key={o.id}>
                      <td>
                        <input className="input py-1.5" value={o.description} onChange={(e) => setObs(o.id, { description: e.target.value })} aria-label="Description" />
                      </td>
                      <td>
                        <Select value={o.direction} onChange={(direction) => setObs(o.id, { direction })} options={COMPASS.map((c) => ({ value: c, label: c }))} />
                      </td>
                      <td>
                        <NumInput value={o.heightM} min={0} onChange={(heightM) => setObs(o.id, { heightM })} suffix="m" />
                      </td>
                      <td>
                        <NumInput value={o.distanceM} min={0.1} onChange={(distanceM) => setObs(o.id, { distanceM })} suffix="m" />
                      </td>
                      <td className="num text-right">{fmt(r?.elevationDeg ?? 0, 1)}°</td>
                      <td>{r?.severity === "high" ? <Badge tone="bad">High</Badge> : r?.severity === "low" ? <Badge tone="warn">Moderate</Badge> : <Badge tone="good">Negligible</Badge>}</td>
                      <td className="text-right">
                        <button className="btn btn-sm text-bad" onClick={() => setA({ obstructions: a.obstructions.filter((x) => x.id !== o.id) })} aria-label="Remove obstruction">
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Roof & structure" subtitle="Dead weight of the modules and mounting against the roof's load capacity">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Roof type">
              <Select
                value={a.roofType}
                onChange={(roofType) => setA({ roofType })}
                options={[
                  { value: "metal", label: "Metal / long-span aluminium" },
                  { value: "concrete", label: "Concrete (flat)" },
                  { value: "tile", label: "Tiles / stone-coated" },
                  { value: "asbestos", label: "Asbestos (do not drill)" },
                  { value: "ground", label: "Ground mount" },
                ]}
              />
            </Field>
            <Field label="Roof condition">
              <Select
                value={a.roofCondition}
                onChange={(roofCondition) => setA({ roofCondition })}
                options={[
                  { value: "good", label: "Good" },
                  { value: "fair", label: "Fair: minor repairs" },
                  { value: "poor", label: "Poor: replace before install" },
                ]}
              />
            </Field>
            <Field label="Pitch (tilt)" hint={`Recommended ≈ ${S.recommendedTiltDeg}°`}>
              <NumInput value={a.roofPitchDeg} min={0} max={90} onChange={(roofPitchDeg) => setA({ roofPitchDeg })} suffix="°" />
            </Field>
            <Field label="Azimuth (direction faced)" hint="0 = N, 90 = E, 180 = S, 270 = W">
              <NumInput value={a.roofAzimuthDeg} min={0} max={360} onChange={(roofAzimuthDeg) => setA({ roofAzimuthDeg })} suffix="°" />
            </Field>
            <Field label="Usable length (along eave)">
              <NumInput value={a.roofLengthM} min={0.5} onChange={(roofLengthM) => setA({ roofLengthM })} suffix="m" />
            </Field>
            <Field label="Usable width (up slope)">
              <NumInput value={a.roofWidthM} min={0.5} onChange={(roofWidthM) => setA({ roofWidthM })} suffix="m" />
            </Field>
            <Field label="Allowable additional load" hint="From a structural assessment of the purlins and rafters">
              <NumInput value={a.roofAllowableLoadKgM2} min={0} onChange={(roofAllowableLoadKgM2) => setA({ roofAllowableLoadKgM2 })} suffix="kg/m²" />
            </Field>
            <Field label="Mounting system weight">
              <NumInput value={a.mountingWeightKgM2} min={0} onChange={(mountingWeightKgM2) => setA({ mountingWeightKgM2 })} suffix="kg/m²" />
            </Field>
          </div>
        </Card>
        <Card title="Existing electrical infrastructure" subtitle="Main panel capacity for a safe interconnection">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Busbar rating">
              <NumInput value={a.busbarRatingA} min={0} onChange={(busbarRatingA) => setA({ busbarRatingA })} suffix="A" />
            </Field>
            <Field label="Main breaker rating">
              <NumInput value={a.mainBreakerA} min={0} onChange={(mainBreakerA) => setA({ mainBreakerA })} suffix="A" />
            </Field>
            <Field label="Spare breaker ways">
              <NumInput value={a.spareWays} min={0} step={1} onChange={(spareWays) => setA({ spareWays })} />
            </Field>
            <Field label="Measured earth resistance" hint="0 = not yet measured">
              <NumInput value={a.earthResistanceOhm} min={0} onChange={(earthResistanceOhm) => setA({ earthResistanceOhm })} suffix="Ω" />
            </Field>
          </div>
          <div className="mt-4">
            <KeyValue
              rows={[
                ["Allowable back-feed (120 % rule)", `${fmt(S.maxBackfeedA)} A`],
                ["Inverter AC breaker", `${results.cables.acBreakerA} A`],
              ]}
            />
          </div>
          <Field label="Assessment notes" className="mt-4">
            <textarea className="input min-h-20" value={a.notes} onChange={(e) => setA({ notes: e.target.value })} />
          </Field>
        </Card>
      </div>
    </div>
  );
}

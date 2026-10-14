"use client";

import { useRef } from "react";
import { SldDiagram, SldStyleSwitch, useSldStyle } from "../diagrams/SldDiagram";
import { Card } from "../ui";
import { useProject } from "../project/ProjectProvider";
import { DistributionTable } from "./DistributionTable";
import { CableScheduleTable, StringPlanTable } from "./ScheduleTables";
import { downloadSvg, slug, useSection } from "./shared";
import { Field, NumInput } from "../ui";

export function SldStep() {
  const { project, results } = useProject();
  const ref = useRef<SVGSVGElement>(null);
  const C = results.cables;
  const D = results.distribution;
  const [cab, setCab] = useSection("cables");
  const [style, setStyle] = useSldStyle();
  return (
    <div className="space-y-6">
      <Card
        title="Single-line diagram"
        subtitle="Generated from the current design: every rating, cable size and protective device updates live"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SldStyleSwitch value={style} onChange={setStyle} />
            <button className="btn btn-sm" onClick={() => downloadSvg(ref.current, `${slug(project.name)}-sld${style === "block" ? "-block" : ""}.svg`)}>
              Download SVG
            </button>
          </div>
        }
        bodyClassName="p-2 sm:p-4 overflow-x-auto"
      >
        <div className={style === "block" ? "min-w-[860px]" : "min-w-[960px]"}>
          <SldDiagram ref={ref} project={project} results={results} style={style} />
        </div>
      </Card>
      <Card
        title="Essential-loads distribution board"
        subtitle={`Final circuits fed by the inverter: ${D.circuits.length} circuits + main switch and SPD use ${D.waysUsed} ways; specify a ${D.boardWays}-way board (25 % spare). Existing house wiring can be reused where it meets these sizes.`}
        actions={
          <Field label="Typical circuit length">
            <NumInput value={cab.finalCircuitLengthM} min={1} max={500} onChange={(finalCircuitLengthM) => setCab({ finalCircuitLengthM })} suffix="m" />
          </Field>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <DistributionTable d={D} />
        </div>
      </Card>
      <Card title="String wiring plan" subtitle="Which modules form each string (rows and positions as on the array layout) and where each string connects" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <StringPlanTable s={results.schedules} />
        </div>
      </Card>
      <Card title="Cable schedule" subtitle="Tag every cable at both ends with these references" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <CableScheduleTable s={results.schedules} />
        </div>
      </Card>
      <Card title="Schedule of protective devices">
        <div className="overflow-x-auto">
          <table className="table min-w-[640px]">
            <thead>
              <tr>
                <th>Circuit</th>
                <th>Cable</th>
                <th>Protective device</th>
              </tr>
            </thead>
            <tbody>
              {C.segments.map((s) => (
                <tr key={s.key}>
                  <td>{s.label}</td>
                  <td className="num">
                    {s.sizeMm2} mm² Cu{s.kind === "dc" ? " (red/black)" : " 3-core"}
                  </td>
                  <td>{s.protectionLabel}</td>
                </tr>
              ))}
              <tr>
                <td>PV input surge protection</td>
                <td>–</td>
                <td>Type II DC SPD, Ucpv {C.dcSpdUcpv} V</td>
              </tr>
              <tr>
                <td>AC surge protection</td>
                <td>–</td>
                <td>{C.acSpd}</td>
              </tr>
              <tr>
                <td>Earthing</td>
                <td>
                  {C.earthing.mainEarthMm2} mm² / {C.earthing.bondingMm2} mm² G/Y
                </td>
                <td>
                  {C.earthing.electrode}, ≤ {C.earthing.targetOhm} Ω
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

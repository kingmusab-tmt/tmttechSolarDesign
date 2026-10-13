"use client";

import { useRef } from "react";
import { SldSvg } from "../diagrams/SldSvg";
import { Card } from "../ui";
import { useProject } from "../project/ProjectProvider";
import { downloadSvg, slug } from "./shared";

export function SldStep() {
  const { project, results } = useProject();
  const ref = useRef<SVGSVGElement>(null);
  const C = results.cables;
  return (
    <div className="space-y-6">
      <Card
        title="Single-line diagram"
        subtitle="Generated from the current design: every rating, cable size and protective device updates live"
        actions={
          <button className="btn btn-sm" onClick={() => downloadSvg(ref.current, `${slug(project.name)}-sld.svg`)}>
            Download SVG
          </button>
        }
        bodyClassName="p-2 sm:p-4 overflow-x-auto"
      >
        <div className="min-w-[860px]">
          <SldSvg ref={ref} project={project} results={results} />
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

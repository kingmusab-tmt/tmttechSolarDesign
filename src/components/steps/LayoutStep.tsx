"use client";

import { useRef } from "react";
import { fmt } from "@/lib/format";
import { ArrayLayoutSvg } from "../diagrams/ArrayLayoutSvg";
import { Card, Field, KeyValue, NumInput, Select, Stat } from "../ui";
import { useProject } from "../project/ProjectProvider";
import { downloadSvg, slug, useSection } from "./shared";

export function LayoutStep() {
  const { results, project } = useProject();
  const [lay, setLay] = useSection("layout");
  const svgRef = useRef<SVGSVGElement>(null);
  const L = results.layout;
  const total = results.strings.totalPanels;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Module positions available" value={L.capacity} hint={`${L.cols} across × ${L.rows} rows`} />
        <Stat label="Modules to place" value={total} tone={L.fits ? "good" : "bad"} hint={L.fits ? "All modules fit" : `${total - L.capacity} will not fit: enlarge the roof area or change the orientation`} />
        <Stat label="Rail required" value={fmt(L.railLengthM, 1)} unit="m" hint={`${L.railPieces} × 4.2 m lengths`} />
        <Stat label="Roof attachments" value={L.roofAttachments} hint="About 1.2 m spacing per rail" />
      </div>

      <Card
        title="Roof layout"
        subtitle={`${project.assessment.roofLengthM} × ${project.assessment.roofWidthM} m roof plane: modules coloured and labelled by string`}
        actions={
          <button className="btn btn-sm" onClick={() => downloadSvg(svgRef.current, `${slug(project.name)}-array-layout.svg`)}>
            Download SVG
          </button>
        }
      >
        <ArrayLayoutSvg ref={svgRef} layout={L} assessment={project.assessment} settings={lay} />
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Layout parameters" subtitle="Roof dimensions are set in the site assessment">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Module orientation">
              <Select
                value={lay.orientation}
                onChange={(orientation) => setLay({ orientation })}
                options={[
                  { value: "portrait", label: "Portrait" },
                  { value: "landscape", label: "Landscape" },
                ]}
              />
            </Field>
            <Field label="Edge setback" hint="Fire-access and maintenance clearance; also reduces wind uplift at the edges">
              <NumInput value={lay.setbackM} min={0} max={5} step={0.1} onChange={(setbackM) => setLay({ setbackM })} suffix="m" />
            </Field>
            <Field label="Gap between modules" hint="Clamp width, typically 20 mm">
              <NumInput value={lay.gapM} min={0} max={1} step={0.01} onChange={(gapM) => setLay({ gapM })} suffix="m" />
            </Field>
            <Field label="Gap between rows">
              <NumInput value={lay.rowGapM} min={0} max={5} step={0.05} onChange={(rowGapM) => setLay({ rowGapM })} suffix="m" />
            </Field>
          </div>
        </Card>
        <Card title="Mounting hardware">
          <KeyValue
            rows={[
              ["Aluminium rails (4.2 m)", `${L.railPieces} pcs (${fmt(L.railLengthM, 1)} m)`],
              ["Rail splices", `${L.railSplices} pcs`],
              ["Mid clamps", `${L.midClamps} pcs`],
              ["End clamps", `${L.endClamps} pcs`],
              ["Roof hooks / L-feet", `${L.roofAttachments} pcs`],
              ["Module earthing clips", `${total} pcs`],
              ["Module area", `${fmt(L.arrayAreaM2, 1)} m²`],
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

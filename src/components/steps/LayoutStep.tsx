"use client";

import { useRef, useState } from "react";
import { resolveMount } from "@/lib/calc/site";
import { fmt } from "@/lib/format";
import { Array3dSvg } from "../diagrams/Array3dSvg";
import { ArrayLayoutSvg } from "../diagrams/ArrayLayoutSvg";
import { cx } from "../ui";
import { Card, Field, KeyValue, NumInput, Select, Stat } from "../ui";
import { useProject } from "../project/ProjectProvider";
import { downloadSvg, slug, useSection } from "./shared";

const MOUNT_NAMES = { flat: "flat roof", ground: "ground mount", gable: "gable roof", shed: "shed roof" } as const;

export function LayoutStep() {
  const { results, project } = useProject();
  const [lay, setLay] = useSection("layout");
  const svgRef = useRef<SVGSVGElement>(null);
  const L = results.layout;
  const total = results.strings.totalPanels;
  const [view, setView] = useState<"3d" | "plan">("3d");
  const mount = resolveMount(project.assessment, lay);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Module positions available" value={L.capacity} hint={`${L.cols} across × ${L.rows} rows`} />
        <Stat label="Modules to place" value={total} tone={L.fits ? "good" : "bad"} hint={L.fits ? "All modules fit" : `${total - L.capacity} will not fit: enlarge the roof area or change the orientation`} />
        <Stat label="Rail required" value={fmt(L.railLengthM, 1)} unit="m" hint={`${L.railPieces} × 4.2 m lengths`} />
        <Stat label="Roof attachments" value={L.roofAttachments} hint="About 1.2 m spacing per rail" />
      </div>

      <Card
        title="Array layout"
        subtitle={`${project.assessment.roofLengthM} × ${project.assessment.roofWidthM} m ${mount === "ground" ? "ground area" : "roof area"}: modules coloured and labelled by string`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select className="input w-auto py-1 text-xs" value={lay.mountType} onChange={(e) => setLay({ mountType: e.target.value as typeof lay.mountType })} aria-label="Mounting type">
              <option value="auto">Auto ({MOUNT_NAMES[resolveMount(project.assessment, { mountType: "auto" })]})</option>
              <option value="flat">Flat roof</option>
              <option value="ground">Ground mount</option>
              <option value="gable">Gable roof</option>
              <option value="shed">Shed roof</option>
            </select>
            <div className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5 text-xs" role="radiogroup" aria-label="View">
              {(
                [
                  ["3d", "3D view"],
                  ["plan", "Top view"],
                ] as const
              ).map(([k, label]) => (
                <button key={k} type="button" role="radio" aria-checked={view === k} onClick={() => setView(k)} className={cx("rounded-md px-2.5 py-1 font-medium whitespace-nowrap", view === k ? "bg-surface text-accent-strong shadow-sm" : "text-muted hover:text-text")}>
                  {label}
                </button>
              ))}
            </div>
            <button className="btn btn-sm" onClick={() => downloadSvg(svgRef.current, `${slug(project.name)}-array-${view === "3d" ? mount : "plan"}.svg`)}>
              Download SVG
            </button>
          </div>
        }
      >
        {view === "3d" ? (
          <Array3dSvg ref={svgRef} layout={L} assessment={project.assessment} settings={lay} mount={mount} tiltDeg={results.site.recommendedTiltDeg} minSunAltitudeDeg={results.site.minNoonAltitudeDeg} azimuthDeg={results.site.recommendedAzimuthDeg} />
        ) : (
          <ArrayLayoutSvg ref={svgRef} layout={L} assessment={project.assessment} settings={lay} />
        )}
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

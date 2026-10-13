"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { EquipmentItem, EquipmentType } from "@/lib/equipment-schema";
import type { DesignInputs, SectionKey } from "@/lib/schemas";
import { useProject } from "../project/ProjectProvider";

type ObjectSections = Exclude<SectionKey, "loads">;

/** Read a section and merge partial updates into it. */
export function useSection<K extends ObjectSections>(key: K) {
  const { project, update } = useProject();
  const set = (patch: Partial<DesignInputs[K]>) => update(key, (prev) => ({ ...prev, ...patch }));
  return [project[key], set] as const;
}

// Short-lived cache: avoids refetching on every step, but picks up items added in the library.
const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; items: Promise<EquipmentItem[]> }>();
function loadEquipment(type: EquipmentType) {
  const hit = cache.get(type);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.items;
  cache.set(type, {
    at: Date.now(),
    items: fetch(`/api/equipment?type=${type}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => d.items as EquipmentItem[])
      .catch(() => {
        cache.delete(type);
        return [];
      }),
  });
  return cache.get(type)!.items;
}

/** Choose an item from the equipment library and copy its datasheet values into the design. */
export function EquipmentPicker({ type, onApply, label = "Load from equipment library" }: { type: EquipmentType; onApply: (item: EquipmentItem) => void; label?: string }) {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [sel, setSel] = useState("");
  useEffect(() => {
    let alive = true;
    loadEquipment(type).then((i) => alive && setItems(i));
    return () => {
      alive = false;
    };
  }, [type]);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1">
        <span className="label">{label}</span>
        <select className="input" value={sel} onChange={(e) => setSel(e.target.value)}>
          <option value="">{items.length ? "Select a model…" : "Loading library…"}</option>
          {items.map((i) => (
            <option key={i._id} value={i._id}>
              {i.verified ? "✓ " : ""}
              {i.brand} {i.model}
              {i.builtIn ? (i.verified ? "" : " (generic)") : " (mine)"}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="btn"
        disabled={!sel}
        onClick={() => {
          const item = items.find((i) => i._id === sel);
          if (item) onApply(item);
        }}
      >
        Apply
      </button>
      {(() => {
        const item = items.find((i) => i._id === sel);
        const href = item?.datasheetFile ? `/api/equipment/${item._id}/datasheet` : item?.datasheetUrl;
        return href ? (
          <a className="btn" href={href} target="_blank" rel="noopener noreferrer" title="Open the original datasheet">
            Datasheet ↗
          </a>
        ) : null;
      })()}
      <Link href="/equipment" className="btn" title="Manage the equipment library">
        Manage
      </Link>
    </div>
  );
}

/** Keep only numeric specs (library items may carry strings such as chemistry). */
export function numericSpecs(specs: Record<string, number | string>) {
  return Object.fromEntries(Object.entries(specs).filter(([, v]) => typeof v === "number")) as Record<string, number>;
}

export function downloadText(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadSvg(svg: SVGSVGElement | null, filename: string) {
  if (!svg) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  // Inline the resolved theme colours so the exported file renders standalone.
  const css = getComputedStyle(document.documentElement);
  let text = new XMLSerializer().serializeToString(clone);
  text = text.replace(/var\((--[\w-]+)\)/g, (_, v) => css.getPropertyValue(v).trim() || "#000");
  downloadText(filename, text, "image/svg+xml");
}

export function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
}

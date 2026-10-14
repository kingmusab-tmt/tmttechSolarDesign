"use client";

import { forwardRef, useEffect, useState } from "react";
import type { DesignResults } from "@/lib/calc";
import type { ProjectData } from "@/lib/schemas";
import { cx } from "../ui";
import { SldSvg } from "./SldSvg";
import { SldSymbolSvg } from "./SldSymbolSvg";

export type SldStyle = "symbols" | "block";
const KEY = "sldStyle";
const EVENT = "sld-style-change";

/** The viewer's preferred SLD style, remembered on this device and shared by the SLD step and the report. */
export function useSldStyle(): [SldStyle, (s: SldStyle) => void] {
  const [style, setStyle] = useState<SldStyle>("symbols");
  useEffect(() => {
    const read = () => {
      try {
        const v = localStorage.getItem(KEY);
        if (v === "symbols" || v === "block") setStyle(v);
      } catch {
        // storage blocked: keep the default
      }
    };
    read();
    window.addEventListener(EVENT, read);
    return () => window.removeEventListener(EVENT, read);
  }, []);
  const set = (s: SldStyle) => {
    setStyle(s);
    try {
      localStorage.setItem(KEY, s);
    } catch {
      // storage blocked: applies to this page view only
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return [style, set];
}

export function SldStyleSwitch({ value, onChange, className }: { value: SldStyle; onChange: (s: SldStyle) => void; className?: string }) {
  return (
    <div className={cx("inline-flex rounded-lg border border-line bg-surface-2 p-0.5 text-xs", className)} role="radiogroup" aria-label="Diagram style">
      {(
        [
          ["symbols", "Electrical symbols"],
          ["block", "Block diagram"],
        ] as const
      ).map(([k, label]) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} onClick={() => onChange(k)} className={cx("rounded-md px-2.5 py-1 font-medium whitespace-nowrap", value === k ? "bg-surface text-accent-strong shadow-sm" : "text-muted hover:text-text")}>
          {label}
        </button>
      ))}
    </div>
  );
}

export const SldDiagram = forwardRef<SVGSVGElement, { project: ProjectData; results: DesignResults; style: SldStyle }>(function SldDiagram({ style, ...props }, ref) {
  return style === "block" ? <SldSvg ref={ref} {...props} /> : <SldSymbolSvg ref={ref} {...props} />;
});

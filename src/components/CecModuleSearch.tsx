"use client";

import { useEffect, useState } from "react";
import type { CecModule } from "@/lib/cec";
import { Badge } from "./ui";

/** Search the 21,000+ module CEC list and act on a result (add to library, use in design, …). */
export function CecModuleSearch({ actionLabel, onSelect, busyId }: { actionLabel: string; onSelect: (m: CecModule) => void | Promise<void>; busyId?: number | null }) {
  const [q, setQ] = useState("");
  const [minW, setMinW] = useState("");
  const [maxW, setMaxW] = useState("");
  const [items, setItems] = useState<CecModule[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (q.trim().length < 2 && !minW && !maxW) {
      setItems([]);
      setTotal(0);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const sp = new URLSearchParams({ q: q.trim(), limit: "40" });
        if (minW) sp.set("minW", minW);
        if (maxW) sp.set("maxW", maxW);
        const res = await fetch(`/api/equipment/cec?${sp}`, { signal: ctrl.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Search failed");
        setItems(data.items);
        setTotal(data.total);
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "Search failed");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, minW, maxW]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input className="input min-w-0 flex-[2]" type="search" placeholder="Manufacturer and/or model, e.g. Jinko JKM550 or LONGi Hi-MO" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search modules" autoFocus />
        <input className="input w-28" type="number" placeholder="Min W" value={minW} onChange={(e) => setMinW(e.target.value)} aria-label="Minimum wattage" />
        <input className="input w-28" type="number" placeholder="Max W" value={maxW} onChange={(e) => setMaxW(e.target.value)} aria-label="Maximum wattage" />
      </div>
      {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      <div className="text-xs text-muted">{loading ? "Searching…" : total > 0 ? `${total.toLocaleString()} match${total === 1 ? "" : "es"}${total > items.length ? `, showing the first ${items.length}. Refine the search to narrow it down.` : ""}` : q.trim().length >= 2 || minW || maxW ? "No modules found" : "Type a manufacturer or model to search 21,677 certified modules"}</div>
      {items.length > 0 && (
        <div className="max-h-96 overflow-auto rounded-lg border border-line">
          <table className="table min-w-[860px] text-xs">
            <thead className="sticky top-0 bg-surface">
              <tr>
                <th>Module</th>
                <th className="text-right">Pmax</th>
                <th className="text-right">Voc / Vmp</th>
                <th className="text-right">Isc / Imp</th>
                <th className="text-right">β Voc</th>
                <th className="text-right">Size (m)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="font-medium">{m.model}</div>
                    <div className="text-muted">
                      {m.manufacturer} · {m.technology}
                      {m.bifacial ? " · bifacial" : ""}
                    </div>
                  </td>
                  <td className="num text-right font-semibold">{m.specs.pmaxW} W</td>
                  <td className="num text-right">
                    {m.specs.vocV} / {m.specs.vmpV} V
                  </td>
                  <td className="num text-right">
                    {m.specs.iscA} / {m.specs.impA} A
                  </td>
                  <td className="num text-right">{m.specs.betaVocPct} %/°C</td>
                  <td className="num text-right">
                    {m.specs.lengthM} × {m.specs.widthM}
                    {m.dimsEstimated && (
                      <div>
                        <Badge tone="warn">est. from area</Badge>
                      </div>
                    )}
                  </td>
                  <td className="text-right">
                    <button className="btn btn-primary btn-sm" disabled={busyId === m.id} onClick={() => onSelect(m)}>
                      {busyId === m.id ? "…" : actionLabel}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-muted">
        Source: California Energy Commission module list, via NREL System Advisor Model libraries (BSD 3-Clause). Weight is not listed and is estimated at 11.5 kg/m²; some dimensions are estimated from the module area. Confirm against the manufacturer&apos;s datasheet.
      </p>
    </div>
  );
}

"use client";

import { fmt, money } from "@/lib/format";
import { Card, Field, NumInput, Stat } from "../ui";
import { useProject } from "../project/ProjectProvider";
import { downloadText, slug, useSection } from "./shared";

export function BoqStep() {
  const { results, project } = useProject();
  const [boq, setBoq] = useSection("boq");
  const B = results.boq;
  const cur = boq.currency;
  const categories = [...new Set(B.items.map((i) => i.category))];

  const setPrice = (key: string, v: number) => setBoq({ prices: { ...boq.prices, [key]: v } });
  const setQty = (key: string, v: number) => setBoq({ qtyOverrides: { ...boq.qtyOverrides, [key]: v } });
  const reset = (key: string) => {
    const { [key]: _p, ...prices } = boq.prices;
    const { [key]: _q, ...qtyOverrides } = boq.qtyOverrides;
    setBoq({ prices, qtyOverrides });
  };
  const setExtra = (id: string, patch: Record<string, unknown>) => setBoq({ extras: boq.extras.map((e) => (e.id === id ? { ...e, ...patch } : e)) });

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [["#", "Category", "Description", "Unit", "Qty", `Unit price (${cur})`, `Total (${cur})`]];
    B.items.forEach((i, n) => rows.push([String(n + 1), i.category, i.description, i.unit, String(i.qty), String(Math.round(i.unitPrice)), String(Math.round(i.total))]));
    rows.push(["", "", "Subtotal", "", "", "", String(Math.round(B.subtotal))]);
    rows.push(["", "", `Contingency (${boq.contingencyPct} %)`, "", "", "", String(Math.round(B.contingency))]);
    rows.push(["", "", `VAT (${boq.vatPct} %)`, "", "", "", String(Math.round(B.vat))]);
    rows.push(["", "", "GRAND TOTAL", "", "", "", String(Math.round(B.grandTotal))]);
    downloadText(`${slug(project.name)}-boq.csv`, rows.map((r) => r.map(esc).join(",")).join("\n"), "text/csv");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Grand total (incl. VAT)" value={money(B.grandTotal, cur)} tone="accent" />
        <Stat label="Cost per watt-peak" value={money(B.costPerWp, cur)} unit="/Wp" />
        <Stat label="Line items" value={B.items.length} />
        <Stat label="Equipment share" value={fmt(B.subtotal > 0 ? ((B.items.filter((i) => ["PV generation", "Power conversion", "Energy storage"].includes(i.category)).reduce((a, i) => a + i.total, 0)) / B.subtotal) * 100 : 0)} unit="%" hint="Modules, inverter, controller, batteries" />
      </div>

      <Card
        title="Bill of Quantities"
        subtitle="Quantities come from the design. Edit any quantity or unit price to override it; prices are indicative and should be updated from supplier quotes."
        actions={
          <>
            <button className="btn btn-sm" onClick={() => setBoq({ extras: [...boq.extras, { id: Math.random().toString(36).slice(2, 10), category: "Other", description: "Additional item", unit: "pcs", qty: 1, unitPrice: 0 }] })}>
              + Custom item
            </button>
            <button className="btn btn-primary btn-sm" onClick={exportCsv}>
              Export CSV
            </button>
          </>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="table min-w-[960px]">
            <thead>
              <tr>
                <th>Description</th>
                <th className="w-16">Unit</th>
                <th className="w-28">Qty</th>
                <th className="w-40">Unit price ({cur})</th>
                <th className="text-right">Total</th>
                <th className="w-16" />
              </tr>
            </thead>
            {categories.map((c) => (
              <tbody key={c}>
                <tr>
                  <td colSpan={6} className="bg-surface-2 text-xs font-semibold tracking-wide text-muted uppercase">
                    {c} · {money(B.categories.find((x) => x.category === c)?.total ?? 0, cur)}
                  </td>
                </tr>
                {B.items
                  .filter((i) => i.category === c)
                  .map((i) => {
                    const extraId = i.auto ? null : i.key.replace(/^extra_/, "");
                    const overridden = i.auto && (boq.prices[i.key] !== undefined || boq.qtyOverrides[i.key] !== undefined);
                    return (
                      <tr key={i.key}>
                        <td>{extraId ? <input className="input py-1.5" value={i.description} onChange={(e) => setExtra(extraId, { description: e.target.value })} aria-label="Description" /> : i.description}</td>
                        <td className="text-muted">{i.unit}</td>
                        <td>
                          <NumInput value={i.qty} min={0} onChange={(v) => (extraId ? setExtra(extraId, { qty: v }) : setQty(i.key, v))} />
                        </td>
                        <td>
                          <NumInput value={Math.round(i.unitPrice)} min={0} onChange={(v) => (extraId ? setExtra(extraId, { unitPrice: v }) : setPrice(i.key, v))} />
                        </td>
                        <td className="num text-right font-medium">{money(i.total, cur)}</td>
                        <td className="text-right">
                          {extraId ? (
                            <button className="btn btn-sm text-bad" onClick={() => setBoq({ extras: boq.extras.filter((e) => e.id !== extraId) })} aria-label="Remove item">
                              ✕
                            </button>
                          ) : overridden ? (
                            <button className="btn btn-sm" onClick={() => reset(i.key)} title="Reset to the calculated quantity and the default price">
                              ↺
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            ))}
            <tfoot>
              <tr>
                <td colSpan={4} className="px-3 py-2 text-right">
                  Subtotal
                </td>
                <td className="num px-3 py-2 text-right">{money(B.subtotal, cur)}</td>
                <td />
              </tr>
              <tr>
                <td colSpan={4} className="px-3 py-2 text-right">
                  Contingency ({boq.contingencyPct} %)
                </td>
                <td className="num px-3 py-2 text-right">{money(B.contingency, cur)}</td>
                <td />
              </tr>
              <tr>
                <td colSpan={4} className="px-3 py-2 text-right">
                  VAT ({boq.vatPct} %)
                </td>
                <td className="num px-3 py-2 text-right">{money(B.vat, cur)}</td>
                <td />
              </tr>
              <tr className="text-base font-bold">
                <td colSpan={4} className="px-3 py-3 text-right">
                  Grand total
                </td>
                <td className="num px-3 py-3 text-right">{money(B.grandTotal, cur)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card title="Commercial settings">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Contingency">
            <NumInput value={boq.contingencyPct} min={0} max={100} onChange={(contingencyPct) => setBoq({ contingencyPct })} suffix="%" />
          </Field>
          <Field label="VAT" hint="Nigeria: 7.5 %">
            <NumInput value={boq.vatPct} min={0} max={100} onChange={(vatPct) => setBoq({ vatPct })} suffix="%" />
          </Field>
          <Field label="Currency code">
            <input className="input" value={boq.currency} maxLength={3} onChange={(e) => setBoq({ currency: e.target.value.toUpperCase() })} />
          </Field>
        </div>
      </Card>
    </div>
  );
}

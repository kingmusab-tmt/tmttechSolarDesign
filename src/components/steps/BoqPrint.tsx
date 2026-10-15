"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { BoqResult } from "@/lib/calc/boq";
import type { ProjectData } from "@/lib/schemas";
import { APP_NAME, COMPANY } from "@/lib/brand";
import { fmt, money } from "@/lib/format";
import { slug } from "./shared";

/**
 * Prints only the Bill of Quantities (choose "Save as PDF" in the print dialog). The sheet is
 * mounted directly under <body> so print CSS can hide everything else while body.print-boq is set.
 */
export function printBoq(projectName: string) {
  const title = document.title;
  document.title = `${slug(projectName)}-bill-of-quantities`; // suggested PDF file name
  document.body.classList.add("print-boq");
  const done = () => {
    document.body.classList.remove("print-boq");
    document.title = title;
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}

export function BoqPrintSheet({ project, boq }: { project: ProjectData; boq: BoqResult }) {
  const [mounted, setMounted] = useState(false);
  const [company, setCompany] = useState("");
  useEffect(() => {
    setMounted(true);
    fetch("/api/account")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => d?.user?.company && setCompany(d.user.company))
      .catch(() => undefined);
  }, []);
  if (!mounted) return null;

  const cur = project.boq.currency;
  const categories = [...new Set(boq.items.map((i) => i.category))];
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  let n = 0;

  return createPortal(
    <div className="boq-print text-[11px] leading-snug text-black">
      <header className="mb-4 flex items-start justify-between gap-6 border-b-2 border-black pb-3">
        <div>
          <div className="text-[10px] font-semibold tracking-widest uppercase">Bill of Quantities</div>
          <h1 className="mt-1 text-xl font-bold">{project.name}</h1>
          <div>
            {project.client.name && `${project.client.name} · `}
            {project.client.address || [project.site.city, project.site.state].filter(Boolean).join(", ")}
            {project.site.locationMethod === "nipost" && project.site.nipost.postcode && ` · NIPOST postcode ${project.site.nipost.postcode}`}
          </div>
        </div>
        <div className="text-right">
          {company && <div className="font-semibold">{company}</div>}
          <div>{today}</div>
          <div>Currency: {cur}</div>
        </div>
      </header>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="w-8 py-1.5 pr-2">#</th>
            <th className="py-1.5 pr-2">Description</th>
            <th className="w-12 py-1.5 pr-2">Unit</th>
            <th className="w-14 py-1.5 pr-2 text-right">Qty</th>
            <th className="w-28 py-1.5 pr-2 text-right">Unit price</th>
            <th className="w-32 py-1.5 text-right">Total</th>
          </tr>
        </thead>
        {categories.map((c) => (
          <tbody key={c} className="break-inside-avoid">
            <tr>
              <td colSpan={5} className="bg-neutral-100 px-1 pt-2.5 pb-1 text-[10px] font-semibold tracking-wide uppercase">
                {c}
              </td>
              <td className="bg-neutral-100 px-1 pt-2.5 pb-1 text-right text-[10px] font-semibold tabular-nums">{money(boq.categories.find((x) => x.category === c)?.total ?? 0, cur)}</td>
            </tr>
            {boq.items
              .filter((i) => i.category === c)
              .map((i) => (
                <tr key={i.key} className="border-b border-neutral-300">
                  <td className="py-1 pr-2 align-top">{++n}</td>
                  <td className="py-1 pr-2 align-top">{i.description}</td>
                  <td className="py-1 pr-2 align-top">{i.unit}</td>
                  <td className="py-1 pr-2 text-right align-top tabular-nums">{fmt(i.qty, i.qty % 1 ? 2 : 0)}</td>
                  <td className="py-1 pr-2 text-right align-top tabular-nums">{money(i.unitPrice, cur)}</td>
                  <td className="py-1 text-right align-top tabular-nums">{money(i.total, cur)}</td>
                </tr>
              ))}
          </tbody>
        ))}
        <tfoot className="break-inside-avoid">
          {(
            [
              ["Subtotal", boq.subtotal],
              [`Contingency (${project.boq.contingencyPct} %)`, boq.contingency],
              [`VAT (${project.boq.vatPct} %)`, boq.vat],
            ] as const
          ).map(([label, v]) => (
            <tr key={label}>
              <td colSpan={5} className="py-1 pr-2 text-right">
                {label}
              </td>
              <td className="py-1 text-right tabular-nums">{money(v, cur)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-black text-[13px] font-bold">
            <td colSpan={5} className="py-2 pr-2 text-right">
              Grand total
            </td>
            <td className="py-2 text-right tabular-nums">{money(boq.grandTotal, cur)}</td>
          </tr>
        </tfoot>
      </table>

      <p className="mt-3">
        Cost per watt-peak: {money(boq.costPerWp, cur)}/Wp. Quantities are derived from the design; prices are indicative and should be confirmed with supplier quotations before purchase.
      </p>
      <p className="mt-6 border-t border-neutral-300 pt-2 text-[9px] text-neutral-600">
        Prepared with {APP_NAME} by {COMPANY.name} ({COMPANY.websiteLabel}).
      </p>
    </div>,
    document.body,
  );
}

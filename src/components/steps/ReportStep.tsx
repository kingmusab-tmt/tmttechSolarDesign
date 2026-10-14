"use client";

import { APP_NAME, COMPANY } from "@/lib/brand";
import { CHEMISTRY_INFO } from "@/lib/calc/constants";
import { COMPLIANCE_ITEMS } from "@/lib/compliance";
import { fmt, money } from "@/lib/format";
import { STEPS } from "@/lib/steps";
import { ArrayLayoutSvg } from "../diagrams/ArrayLayoutSvg";
import { SldSvg } from "../diagrams/SldSvg";
import { StatusIcon } from "../ui";
import { useEffect, useState } from "react";
import { useProject } from "../project/ProjectProvider";
import { useRevisions } from "../project/Revisions";

function Section({ n, title, children, breakBefore }: { n: number; title: string; children: React.ReactNode; breakBefore?: boolean }) {
  return (
    <section className={breakBefore ? "print-break" : undefined}>
      <h2 className="mb-3 border-b-2 border-accent pb-1 text-lg font-bold">
        {n}. {title}
      </h2>
      {children}
    </section>
  );
}

function T({ rows, head }: { rows: (string | number)[][]; head?: string[] }) {
  return (
    <div className="overflow-x-auto">
    <table className="w-full border-collapse text-sm">
      {head && (
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="border border-line bg-surface-2 px-2 py-1.5 text-left text-xs font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} className={`num border border-line px-2 py-1.5 ${j === 0 && !head ? "w-1/2 text-muted" : ""}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

export function ReportStep() {
  const { project: p, results: r, progress } = useProject();
  const cur = p.boq.currency;
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const fails = r.checks.filter((c) => c.status === "fail");
  const warns = r.checks.filter((c) => c.status === "warn");
  const { revisions } = useRevisions(p._id);
  const latestRev = revisions[0];
  const [company, setCompany] = useState("");
  useEffect(() => {
    fetch("/api/account")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => d?.user?.company && setCompany(d.user.company))
      .catch(() => undefined);
  }, []);

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
        <p className="text-sm text-muted">The complete engineering report. Use your browser&apos;s print dialog and choose “Save as PDF”.</p>
        <button className="btn btn-primary" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>

      <article className="card space-y-8 p-6 sm:p-10 print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
          <div>
            <div className="text-xs font-semibold tracking-widest text-accent-strong uppercase">Solar Home System: Engineering Design Report</div>
            <h1 className="mt-2 text-3xl font-bold">{p.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {p.client.name && `${p.client.name} · `}
              {p.client.address || `${p.site.city}, ${p.site.state}`}
            </p>
          </div>
          <div className="text-right text-sm">
            <div>{today}</div>
            {company && <div className="font-semibold">{company}</div>}
            <div className="text-muted">{latestRev ? `Revision ${latestRev.label} (${new Date(latestRev.createdAt).toLocaleDateString("en-GB")})` : "Working draft (no revision issued)"}</div>
            <div className="text-muted">Status: {p.status}</div>
            <div className="text-muted">Design progress: {progress.pct} %</div>
          </div>
        </header>

        <Section n={1} title="Executive summary">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["PV array", `${fmt(r.strings.arrayW / 1000, 2)} kWp`],
              ["Inverter", `${fmt(r.inverter.ratedPowerW / 1000, 1)} kW`],
              ["Battery", `${fmt(r.battery.bankKWh, 1)} kWh`],
              ["Daily demand", `${fmt(r.load.dailyWh / 1000, 2)} kWh`],
              ["Daily yield", `${fmt(r.pv.dailyYieldKWh, 2)} kWh`],
              ["Total cost", money(r.boq.grandTotal, cur)],
              ["Payback", r.financial.paybackYears !== null ? `${fmt(r.financial.paybackYears, 1)} years` : "–"],
              ["NPV", money(r.financial.npv, cur)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-line p-3">
                <div className="text-[11px] text-muted uppercase">{k}</div>
                <div className="num font-semibold">{v}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm">
            A {p.inverter.type === "hybrid" ? "hybrid" : "standalone off-grid"} solar home system at {r.inverter.systemVoltage} V DC with {r.strings.totalPanels} × {p.pv.panel.pmaxW} Wp modules ({r.strings.series} in series × {r.strings.parallel} string
            {r.strings.parallel > 1 ? "s" : ""}), a {fmt(r.inverter.ratedPowerW / 1000, 1)} kW inverter and a {fmt(r.battery.bankKWh, 1)} kWh {CHEMISTRY_INFO[p.battery.chemistry].label} battery bank giving {fmt(r.battery.actualAutonomyDays, 1)} day(s) of autonomy. The
            design has {fails.length} failing check{fails.length === 1 ? "" : "s"} and {warns.length} warning{warns.length === 1 ? "" : "s"}.
          </p>
        </Section>

        <Section n={2} title="Site & design basis">
          <T
            rows={[
              ["Location", `${p.site.city}, ${p.site.state}, ${p.site.country} (${p.site.latitude}°, ${p.site.longitude}°)`],
              ["Peak sun hours", `${p.site.peakSunHours} h/day (${p.site.climateSource})`],
              ...(p.site.monthlyPsh.length === 12 ? [["Monthly PSH (Jan–Dec)", p.site.monthlyPsh.map((v) => v.toFixed(1)).join(" · ")]] : []),
              ["Design temperatures", `Tmin ${p.site.tMin} °C · Tmax ${p.site.tMax} °C`],
              ["Roof", `${p.assessment.roofType}, pitch ${p.assessment.roofPitchDeg}°, azimuth ${p.assessment.roofAzimuthDeg}°, ${p.assessment.roofLengthM} × ${p.assessment.roofWidthM} m`],
              ["Shading loss", `${p.assessment.shadingLossPct} % (${p.assessment.shadingMethod.replace("_", " ")})`],
              ["Grid / generator available", p.site.gridAvailable ? "Yes" : "No"],
            ]}
          />
        </Section>

        <Section n={3} title="Load audit">
          <T
            head={["Appliance", "W", "Qty", "h/day", "Surge", "Wh/day"]}
            rows={[...r.load.rows.map((l) => [l.name, fmt(l.watts), fmt(l.qty), fmt(l.hoursPerDay, 1), l.inductive ? `${l.surgeFactor}×` : "–", fmt(l.dailyWh)]), ["Total", fmt(r.load.connectedW), "", "", `Peak ${fmt(r.load.peakSurgeW)} W`, fmt(r.load.dailyWh)]]}
          />
        </Section>

        <Section n={4} title="Component sizing" breakBefore>
          <div className="grid gap-4 md:grid-cols-2">
            <T
              head={["Inverter", ""]}
              rows={[
                ["Required continuous", `${fmt(r.inverter.requiredContinuousW)} W`],
                ["Required surge", `${fmt(r.inverter.requiredSurgeW)} W`],
                ["Selected", `${r.inverter.spec.brand} ${r.inverter.spec.model}${r.inverter.isSelected ? "" : " (generic: select a model)"}`],
                ["System voltage", `${r.inverter.systemVoltage} V`],
              ]}
            />
            <T
              head={["Battery bank", ""]}
              rows={[
                ["Required capacity", `${fmt(r.battery.requiredAh)} Ah`],
                ["Configuration", `${r.battery.seriesCount}S × ${r.battery.parallelCount}P (${r.battery.totalUnits} units)`],
                ["Installed / usable", `${fmt(r.battery.bankKWh, 1)} / ${fmt(r.battery.usableKWh, 1)} kWh`],
                ["DoD · autonomy", `${fmt(p.battery.dod * 100)} % · ${fmt(r.battery.actualAutonomyDays, 2)} days`],
              ]}
            />
            <T
              head={["PV array & strings", ""]}
              rows={[
                ["Required PV power", `${fmt(r.pv.requiredPvW)} Wp`],
                ["Module", `${p.pv.panel.brand} ${p.pv.panel.model}`],
                ["Configuration", `${r.strings.series} series × ${r.strings.parallel} parallel`],
                ["String Voc at Tmin", `${fmt(r.strings.stringVocCold, 1)} V (limit ${r.strings.device.maxDcVoltage} V)`],
                ["String Vmp hot / cold", `${fmt(r.strings.stringVmpHot, 1)} / ${fmt(r.strings.stringVmpCold, 1)} V`],
              ]}
            />
            <T
              head={["Charge control", ""]}
              rows={
                r.controller.applicable
                  ? [
                      ["Required current", `${fmt(r.controller.requiredA, 1)} A`],
                      ["Selected", `${r.controller.count} × ${r.controller.ratedA} A MPPT`],
                    ]
                  : [
                      ["Type", "Built into the hybrid inverter"],
                      ["PV charge current", `${fmt(r.controller.hybridChargeA)} A (max ${r.inverter.spec.maxChargeCurrentA} A)`],
                    ]
              }
            />
          </div>
        </Section>

        <Section n={5} title="Cables & protection">
          <T head={["Circuit", "Length", "Current", "Cable", "Drop", "Protection"]} rows={r.cables.segments.map((s) => [s.label, `${s.lengthM} m`, `${fmt(s.operatingA, 1)} A`, `${s.sizeMm2} mm²`, `${fmt(s.dropPct, 2)} %`, s.protectionLabel])} />
          <p className="mt-2 text-xs text-muted">
            DC SPD Type II Ucpv {r.cables.dcSpdUcpv} V · {r.cables.acSpd} · Earthing: {r.cables.earthing.electrode}, ≤ {r.cables.earthing.targetOhm} Ω, {r.cables.earthing.mainEarthMm2} mm² main / {r.cables.earthing.bondingMm2} mm² bonding
          </p>
        </Section>

        <Section n={6} title="Single-line diagram" breakBefore>
          <SldSvg project={p} results={r} />
        </Section>

        <Section n={7} title="Array layout & structure">
          <ArrayLayoutSvg layout={r.layout} assessment={p.assessment} settings={p.layout} />
          <p className="mt-2 text-sm">
            Dead load {fmt(r.site.deadLoadKgM2, 1)} kg/m² (total {fmt(r.site.arrayWeightKg)} kg) against an allowable {p.assessment.roofAllowableLoadKgM2} kg/m². Mounting: {r.layout.railPieces} rails, {r.layout.midClamps} mid clamps, {r.layout.endClamps} end clamps,{" "}
            {r.layout.roofAttachments} roof attachments.
          </p>
        </Section>

        <Section n={8} title="Bill of Quantities" breakBefore>
          <T
            head={["#", "Description", "Qty", "Unit price", "Total"]}
            rows={[
              ...r.boq.items.map((i, n) => [n + 1, i.description, `${fmt(i.qty)} ${i.unit}`, money(i.unitPrice, cur), money(i.total, cur)]),
              ["", "Subtotal", "", "", money(r.boq.subtotal, cur)],
              ["", `Contingency ${p.boq.contingencyPct} %`, "", "", money(r.boq.contingency, cur)],
              ["", `VAT ${p.boq.vatPct} %`, "", "", money(r.boq.vat, cur)],
              ["", "GRAND TOTAL", "", "", money(r.boq.grandTotal, cur)],
            ]}
          />
        </Section>

        <Section n={9} title="Financial analysis">
          <T
            rows={[
              ["Capital cost", money(r.financial.capex, cur)],
              ["Current annual energy spend", money(r.financial.annualBaselineCost, cur)],
              ["Year-1 savings", money(r.financial.year1Savings, cur)],
              ["Simple payback", r.financial.paybackYears !== null ? `${fmt(r.financial.paybackYears, 1)} years` : "Beyond analysis period"],
              [`NPV (${p.financial.discountRatePct} %)`, money(r.financial.npv, cur)],
              ["IRR", r.financial.irr !== null ? `${fmt(r.financial.irr * 100, 1)} %` : "–"],
              ["LCOE", `${money(r.financial.lcoe, cur)}/kWh`],
              ["CO₂ avoided", `${fmt(r.financial.co2AvoidedTonnesPerYear, 1)} t/year`],
            ]}
          />
        </Section>

        <Section n={10} title="Design verification & compliance" breakBefore>
          <ul className="space-y-1.5">
            {r.checks
              .filter((c) => c.status !== "info")
              .map((c) => (
                <li key={c.id} className="flex gap-2 text-sm">
                  <StatusIcon status={c.status} />
                  <span>
                    <strong>{STEPS.find((s) => s.key === c.step)?.short}:</strong> {c.label}. <span className="text-muted">{c.detail}</span>
                  </span>
                </li>
              ))}
          </ul>
          <h3 className="mt-5 mb-2 font-semibold">Compliance checklist</h3>
          <T
            head={["Requirement", "Standard", "Verified", "Notes"]}
            rows={COMPLIANCE_ITEMS.map((i) => {
              const v = p.compliance.items[i.key];
              return [i.label, i.standard, v?.checked ? "✓" : "–", v?.notes ?? ""];
            })}
          />
        </Section>

        <section className="grid gap-8 border-t border-line pt-6 sm:grid-cols-2">
          <div>
            <div className="text-xs text-muted">Design engineer</div>
            <div className="mt-8 border-b border-text" />
            <div className="mt-1 text-sm">{p.compliance.engineerName || "Name"}</div>
            <div className="text-xs text-muted">COREN reg. no.: {p.compliance.corenNumber || "________"}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Date</div>
            <div className="mt-8 border-b border-text" />
            <div className="mt-1 text-sm">{p.compliance.signOffDate || "________"}</div>
          </div>
        </section>
        <p className="text-[11px] text-muted">
          Indicative design based on user inputs and typical datasheet and climate values. Verify against manufacturer datasheets, measured site data and applicable standards before construction.
        </p>
        <p className="text-[11px] text-muted">
          Climate data: {p.site.climateSource}. NASA POWER data were obtained from the NASA Langley Research Center (LaRC) POWER Project funded through the NASA Earth Science/Applied Science Program. Global Solar Atlas 2.0 is operated by Solargis s.r.o. on
          behalf of the World Bank Group with funding from ESMAP (CC BY 4.0). PV module data from the California Energy Commission list via NREL System Advisor Model (BSD 3-Clause). Product names belong to their respective owners.
        </p>
        <p className="text-[11px] text-muted">
          Prepared with {APP_NAME} by {COMPANY.name} ({COMPANY.websiteLabel}).
        </p>
      </article>
    </div>
  );
}

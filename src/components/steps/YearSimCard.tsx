"use client";

import type { SimulationResult } from "@/lib/calc/simulation";
import { fmt } from "@/lib/format";
import { MonthlyChart } from "../charts/MonthlyChart";
import { Card, Stat } from "../ui";

/** Hour-by-hour simulation of a typical year: battery charge, backup energy and surplus PV. */
export function YearSimCard({ sim, compact = false }: { sim: SimulationResult; compact?: boolean }) {
  const a = sim.annual;
  const backupLabel = sim.backupSource === "unserved" ? "Unserved energy" : "From grid / generator";
  const body = (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Demand met by solar + battery" value={fmt(a.solarFractionPct, 1)} unit="%" tone={a.solarFractionPct >= 99.5 ? "good" : sim.backupSource === "unserved" && a.solarFractionPct < 97 ? "bad" : "warn"} />
        <Stat label="Days with a shortfall" value={a.shortDays} hint={`${fmt(a.lossOfLoadHoursPct, 1)} % of hours`} tone={a.shortDays === 0 ? "good" : undefined} />
        <Stat label={backupLabel} value={fmt(a.backupKWh)} unit="kWh/yr" />
        <Stat label="Battery cycles" value={fmt(a.cycles)} unit="/yr" hint={`Surplus PV ${fmt(a.surplusKWh)} kWh/yr`} />
      </div>
      {!compact && (
        <div className="mt-5">
          <MonthlyChart values={sim.months.map((m) => Math.round(m.minSocPct))} unit="%" title="Lowest battery charge each month (% of usable capacity)" />
        </div>
      )}
      <div className="mt-4 overflow-x-auto">
        <table className="table min-w-[640px] text-xs">
          <thead>
            <tr>
              <th>Month</th>
              <th className="text-right">PV kWh</th>
              <th className="text-right">Load kWh</th>
              <th className="text-right">{sim.backupSource === "unserved" ? "Unserved" : "Backup"} kWh</th>
              <th className="text-right">Surplus kWh</th>
              <th className="text-right">Lowest charge</th>
              <th className="text-right">Short days</th>
            </tr>
          </thead>
          <tbody>
            {sim.months.map((m) => (
              <tr key={m.month}>
                <td>{m.month}</td>
                <td className="num text-right">{fmt(m.pvKWh)}</td>
                <td className="num text-right">{fmt(m.loadKWh)}</td>
                <td className={`num text-right ${m.backupKWh > 0.5 ? "font-semibold" : ""}`}>{fmt(m.backupKWh, 1)}</td>
                <td className="num text-right">{fmt(m.surplusKWh)}</td>
                <td className="num text-right">{fmt(m.minSocPct)} %</td>
                <td className="num text-right">{m.shortDays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted">
        Hour-by-hour over a typical year: each month&apos;s design yield with day-to-day weather variation, lighting in the evening and other loads over a household profile, battery between full and its depth-of-discharge limit with
        round-trip losses. Use it to judge autonomy; it is not a substitute for a full PV simulation of the site.
      </p>
    </>
  );
  return compact ? body : <Card title="Year-round simulation" subtitle="How the battery copes through the seasons, hour by hour">{body}</Card>;
}

"use client";

import Link from "next/link";
import { fmt, money, timeAgo } from "@/lib/format";
import { STEPS } from "@/lib/steps";
import { Badge, Card, CheckList, ProgressBar, Stat, cx } from "../ui";
import { useProject } from "./ProjectProvider";
import { ChangeRequestsCard } from "./ChangeRequestsCard";
import { RevisionsCard } from "./Revisions";

export function ProjectOverview() {
  const { project, results: r, steps, progress } = useProject();
  const base = `/projects/${project._id}`;
  const hasLoads = project.loads.length > 0;
  const issues = r.checks.filter((c) => c.status === "fail" || c.status === "warn");
  const nextStep = STEPS.find((s) => steps[s.key].status !== "complete");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Project overview</h1>
          <p className="text-sm text-muted">
            {[project.client.name, project.site.city && `${project.site.city}, ${project.site.state}`].filter(Boolean).join(" · ") || "No client details yet"} · updated {timeAgo(project.updatedAt)}
          </p>
        </div>
        {nextStep && (
          <Link href={`${base}/${nextStep.key}`} className="btn btn-primary">
            Continue: {nextStep.title} →
          </Link>
        )}
      </div>

      {hasLoads ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Daily energy demand" value={fmt(r.load.dailyWh / 1000, 2)} unit="kWh/day" />
          <Stat label="PV array" value={fmt(r.strings.arrayW / 1000, 2)} unit="kWp" tone="accent" hint={`${r.strings.totalPanels} × ${project.pv.panel.pmaxW} W · ${r.strings.series}S × ${r.strings.parallel}P`} />
          <Stat label="Inverter" value={fmt(r.inverter.ratedPowerW / 1000, 1)} unit="kW" hint={`${project.inverter.type === "hybrid" ? "Hybrid" : "Standalone"} · ${r.inverter.systemVoltage} V DC`} />
          <Stat label="Battery bank" value={fmt(r.battery.bankKWh, 1)} unit="kWh" hint={`${r.battery.totalUnits} × ${project.battery.unitVoltage} V ${project.battery.unitAh} Ah · ${fmt(r.battery.actualAutonomyDays, 1)} days autonomy`} />
          <Stat label="Expected yield" value={fmt(r.pv.dailyYieldKWh, 1)} unit="kWh/day" />
          <Stat label="System cost" value={money(r.boq.grandTotal, project.boq.currency)} />
          <Stat label="Payback" value={r.financial.paybackYears !== null ? fmt(r.financial.paybackYears, 1) : "–"} unit="years" />
          <Stat label="Design issues" value={r.checks.filter((c) => c.status === "fail").length} tone={r.checks.some((c) => c.status === "fail") ? "bad" : "good"} hint={`${r.checks.filter((c) => c.status === "warn").length} warnings`} />
        </div>
      ) : (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">Start with the load audit</h2>
              <p className="text-sm text-muted">The load sizes every other component: list the appliances, their wattage and hours of use.</p>
            </div>
            <Link className="btn btn-primary" href={`${base}/loads`}>
              Open load audit
            </Link>
          </div>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card title="Design progress" subtitle={`${progress.completed} complete · ${progress.inProgress} in progress · ${progress.total - progress.completed - progress.inProgress} not started`} actions={<span className="num text-lg font-semibold">{progress.pct} %</span>}>
          <ProgressBar pct={progress.pct} className="mb-5" />
          <ol className="grid gap-2 sm:grid-cols-2">
            {STEPS.map((s, i) => {
              const st = steps[s.key];
              return (
                <li key={s.key}>
                  <Link href={`${base}/${s.key}`} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 hover:bg-surface-2">
                    <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", st.status === "complete" ? "bg-good text-white" : st.status === "in_progress" ? "bg-accent-soft text-accent-strong" : "bg-surface-2 text-muted")}>{st.status === "complete" ? "✓" : i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{s.title}</span>
                    {st.fails > 0 && <Badge tone="bad">{st.fails} ✕</Badge>}
                    {st.fails === 0 && st.warns > 0 && <Badge tone="warn">{st.warns} !</Badge>}
                  </Link>
                </li>
              );
            })}
          </ol>
        </Card>
        <Card title="Issues to resolve" subtitle="Failing checks and warnings across all steps">
          {hasLoads ? <CheckList checks={issues} empty="No issues: every automatic check passes." /> : <p className="text-sm text-muted">Checks run once the load audit has data.</p>}
        </Card>
      </div>
      <ChangeRequestsCard />
      <RevisionsCard />
    </div>
  );
}

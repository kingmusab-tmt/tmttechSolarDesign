"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fmt, moneyCompact, timeAgo } from "@/lib/format";
import { PROJECT_STATUSES } from "@/lib/schemas";
import type { ProjectSummary } from "@/lib/server/projects";
import { ProjectActions } from "./ProjectActions";

const STATUS_LABEL: Record<string, string> = { draft: "Draft", designing: "Designing", review: "In review", approved: "Approved", installed: "Installed", commissioned: "Commissioned" };

type Sort = "updated" | "name" | "progress" | "size" | "cost";

export function ProjectGrid({ projects }: { projects: ProjectSummary[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<Sort>("updated");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = projects.filter((p) => (status === "all" || p.status === status) && (!needle || [p.name, p.clientName, p.city, p.orgName, p.ownerName].some((v) => v.toLowerCase().includes(needle))));
    const by: Record<Sort, (a: ProjectSummary, b: ProjectSummary) => number> = {
      updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      name: (a, b) => a.name.localeCompare(b.name),
      progress: (a, b) => b.progressPct - a.progressPct,
      size: (a, b) => b.arrayKWp - a.arrayKWp,
      cost: (a, b) => b.capex - a.capex,
    };
    return [...list].sort(by[sort]);
  }, [projects, q, status, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input className="input min-w-0 flex-1" type="search" placeholder="Search by project, client or city…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search projects" />
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="all">All statuses</option>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort projects">
          <option value="updated">Recently updated</option>
          <option value="name">Name</option>
          <option value="progress">Progress</option>
          <option value="size">PV size</option>
          <option value="cost">Cost</option>
        </select>
      </div>
      {shown.length === 0 ? (
        <p className="card p-8 text-center text-sm text-muted">No projects match these filters.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map((p) => (

                <article key={p._id} className="card flex flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/projects/${p._id}`} className="block truncate font-semibold hover:text-accent-strong">
                        {p.name}
                      </Link>
                      <div className="truncate text-xs text-muted">
                        {[p.clientName, p.city].filter(Boolean).join(" · ") || "No client yet"} · updated {timeAgo(p.updatedAt)}
                      </div>
                    </div>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">{STATUS_LABEL[p.status]}</span>
                      {p.orgName && (
                        <span className="rounded-full bg-info-soft px-2 py-0.5 text-[11px] font-medium text-info" title={p.isOwner ? `You shared this with ${p.orgName}` : `Shared by ${p.ownerName}`}>
                          👥 {p.orgName}
                          {!p.isOwner && ` · ${p.ownerName}`}
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-muted">
                        {p.completedSteps}/{p.totalSteps} steps complete
                      </span>
                      <span className="num font-medium">{p.progressPct} %</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${p.progressPct}%` }} />
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
                    {[
                      ["PV", `${fmt(p.arrayKWp, 1)} kWp`],
                      ["Inverter", `${fmt(p.inverterKW, 1)} kW`],
                      ["Battery", `${fmt(p.batteryKWh, 1)} kWh`],
                      ["Cost", p.capex ? moneyCompact(p.capex) : "–"],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-surface-2 px-1 py-2">
                        <dt className="text-[10px] text-muted uppercase">{k}</dt>
                        <dd className="num text-xs font-semibold">{p.dailyKWh > 0 ? v : "–"}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    {p.issues > 0 ? <span className="text-xs font-medium text-bad">✕ {p.issues} design issue{p.issues > 1 ? "s" : ""}</span> : <span className="text-xs text-muted">{p.dailyKWh > 0 ? "No blocking issues" : "Start with the load audit"}</span>}
                    <ProjectActions id={p._id} name={p.name} canDelete={p.isOwner} />
                  </div>
                </article>
          ))}
        </div>
      )}
    </div>
  );
}

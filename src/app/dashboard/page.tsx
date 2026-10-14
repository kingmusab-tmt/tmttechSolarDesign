import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewProjectForm } from "@/components/dashboard/NewProjectForm";
import { ProjectGrid } from "@/components/dashboard/ProjectGrid";
import { fmt, moneyCompact } from "@/lib/format";
import { getSession } from "@/lib/server/auth";
import { listProjectSummaries, type ProjectSummary } from "@/lib/server/projects";

export const metadata: Metadata = { title: "Projects" };
export const dynamic = "force-dynamic";


export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/login");

  let projects: ProjectSummary[] = [];
  let dbError = "";
  try {
    projects = await listProjectSummaries(session.userId);
  } catch (e) {
    console.error(e);
    dbError = "Could not reach the database. Check MONGODB_URI in .env.local and make sure MongoDB is running.";
  }

  const totals = {
    count: projects.length,
    kWp: projects.reduce((a, p) => a + p.arrayKWp, 0),
    kWh: projects.reduce((a, p) => a + p.batteryKWh, 0),
    value: projects.reduce((a, p) => a + p.capex, 0),
    avgProgress: projects.length ? Math.round(projects.reduce((a, p) => a + p.progressPct, 0) / projects.length) : 0,
  };

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-muted">Welcome back, {session.name.split(" ")[0]}. Pick up where you left off.</p>
        </div>
      </div>

      {dbError && <div className="mt-6 rounded-xl border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">{dbError}</div>}

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Projects", fmt(totals.count)],
          ["PV designed", `${fmt(totals.kWp, 1)} kWp`],
          ["Storage designed", `${fmt(totals.kWh, 1)} kWh`],
          ["Pipeline value", moneyCompact(totals.value)],
          ["Average progress", `${totals.avgProgress} %`],
        ].map(([k, v]) => (
          <div key={k} className="card p-4">
            <div className="text-xs text-muted">{k}</div>
            <div className="num mt-1 text-xl font-semibold">{v}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0">
          {projects.length === 0 && !dbError ? (
            <div className="card flex flex-col items-center justify-center p-12 text-center">
              <div className="text-4xl">☀️</div>
              <h2 className="mt-3 font-semibold">No projects yet</h2>
              <p className="mt-1 max-w-sm text-sm text-muted">Create your first design. Start from a sample 3-bedroom home to see every step populated straight away.</p>
            </div>
          ) : (
            <ProjectGrid projects={projects} />
          )}
        </section>
        <aside>
          <NewProjectForm />
        </aside>
      </div>
    </main>
  );
}

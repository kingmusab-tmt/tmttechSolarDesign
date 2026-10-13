import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/auth";
import { STEPS } from "@/lib/steps";

export default async function Home() {
  if (await getSession()) redirect("/dashboard");
  const phases = ["Sizing", "Engineering", "Deliverables"] as const;
  return (
    <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <span className="inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong">Progressive web app · works offline</span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Design solar home systems the way engineers do.</h1>
          <p className="mt-4 text-lg text-muted">
            A guided, sequential workflow from the load audit to a signed-off design: inverter, battery, PV and charge-controller sizing, temperature-corrected string design, cable and protection sizing, single-line diagrams, roof
            layouts, compliance, Bill of Quantities and financial modelling, with progress tracked on every project.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/register" className="btn btn-primary px-5 py-2.5">
              Create free account
            </Link>
            <Link href="/calculator" className="btn px-5 py-2.5">
              Try the quick calculator
            </Link>
          </div>
        </div>
        <div className="card p-6">
          <h2 className="text-sm font-semibold">String voltage at the coldest temperature</h2>
          <p className="mt-1 text-xs text-muted">Calculated automatically for every design</p>
          <div className="mt-4 rounded-lg bg-surface-2 p-4 font-mono text-sm">
            V<sub>max</sub> = V<sub>oc</sub> × [1 + β/100 × (T<sub>min</sub> − 25)]
            <div className="mt-2 text-xs text-muted">= 41.5 × [1 + (−0.29/100) × (0 − 25)] = 44.51 V</div>
            <div className="mt-2 font-semibold text-accent-strong">⌊600 V ÷ 44.51 V⌋ = 13 panels per string</div>
          </div>
        </div>
      </section>

      <section className="mt-16 grid gap-6 md:grid-cols-3">
        {phases.map((phase) => (
          <div key={phase} className="card p-5">
            <h3 className="text-xs font-semibold tracking-wide text-accent-strong uppercase">{phase}</h3>
            <ol className="mt-3 space-y-2.5">
              {STEPS.filter((s) => s.phase === phase).map((s) => (
                <li key={s.key} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-semibold text-muted">{STEPS.indexOf(s) + 1}</span>
                  <div>
                    <div className="text-sm font-medium">{s.title}</div>
                    <div className="text-xs text-muted">{s.description}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>
    </main>
  );
}

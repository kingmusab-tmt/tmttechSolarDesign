"use client";

import Link from "next/link";
import { useEffect, type ComponentType } from "react";
import { checksForStep } from "@/lib/calc";
import type { StepKey } from "@/lib/schemas";
import { STEPS, STEP_INDEX } from "@/lib/steps";
import { AssessmentStep } from "../steps/AssessmentStep";
import { BatteryStep } from "../steps/BatteryStep";
import { BoqStep } from "../steps/BoqStep";
import { CablesStep } from "../steps/CablesStep";
import { ComplianceStep } from "../steps/ComplianceStep";
import { ControllerStep } from "../steps/ControllerStep";
import { FinancialStep } from "../steps/FinancialStep";
import { InverterStep } from "../steps/InverterStep";
import { LayoutStep } from "../steps/LayoutStep";
import { LoadsStep } from "../steps/LoadsStep";
import { PvStep } from "../steps/PvStep";
import { ReportStep } from "../steps/ReportStep";
import { SiteStep } from "../steps/SiteStep";
import { SldStep } from "../steps/SldStep";
import { StringsStep } from "../steps/StringsStep";
import { Badge, Card, CheckList } from "../ui";
import { LockBanner, NoticeBanner, ProposalBar, SectionOwnership, StepReadOnly } from "./CollabBits";
import { useProject } from "./ProjectProvider";

const COMPONENTS: Record<StepKey, ComponentType> = {
  site: SiteStep,
  loads: LoadsStep,
  inverter: InverterStep,
  battery: BatteryStep,
  pv: PvStep,
  strings: StringsStep,
  controller: ControllerStep,
  cables: CablesStep,
  assessment: AssessmentStep,
  layout: LayoutStep,
  sld: SldStep,
  compliance: ComplianceStep,
  boq: BoqStep,
  financial: FinancialStep,
  report: ReportStep,
};

export function StepView({ stepKey }: { stepKey: StepKey }) {
  const { project, results, steps, toggleComplete, lockedBy, acquireStep, setActiveStep } = useProject();
  const i = STEP_INDEX[stepKey];
  const meta = STEPS[i];
  const prev = STEPS[i - 1];
  const next = STEPS[i + 1];
  const Body = COMPONENTS[stepKey];
  const state = steps[stepKey];
  const checks = checksForStep(results, stepKey);
  const base = `/projects/${project._id}`;
  const needsLoads = stepKey !== "site" && stepKey !== "loads" && project.loads.length === 0;
  const lock = lockedBy(stepKey);

  // Tell the collaboration layer which step is open (presence, and releasing locks on navigation).
  useEffect(() => {
    setActiveStep(stepKey);
    return () => setActiveStep("");
  }, [stepKey, setActiveStep]);

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold tracking-wide text-accent-strong uppercase">
            Step {i + 1} of {STEPS.length} · {meta.phase}
          </div>
          <h1 className="mt-1 text-2xl font-bold">{meta.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">{meta.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {state.status === "complete" ? <Badge tone="good">✓ Complete</Badge> : state.status === "in_progress" ? <Badge tone="accent">In progress</Badge> : <Badge>Not started</Badge>}
        </div>
      </div>

      {needsLoads && (
        <div className="no-print rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
          Every component is sized from the load. Complete the{" "}
          <Link className="font-semibold underline" href={`${base}/loads`}>
            load audit
          </Link>{" "}
          first.
        </div>
      )}

      <NoticeBanner />
      <SectionOwnership step={stepKey} />
      <LockBanner step={stepKey} />

      {/* Claim the step for editing on first interaction; read-only while a teammate holds it. */}
      <div onFocusCapture={() => void acquireStep(stepKey)} onPointerDownCapture={() => void acquireStep(stepKey)}>
        <StepReadOnly readOnly={Boolean(lock)}>
          <Body />
        </StepReadOnly>
      </div>

      <ProposalBar step={stepKey} />

      {stepKey !== "report" && checks.length > 0 && (
        <Card title="Design checks" subtitle="Verified automatically against the current inputs" className="no-print">
          <CheckList checks={checks} />
        </Card>
      )}

      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        {prev ? (
          <Link className="btn" href={`${base}/${prev.key}`}>
            ← {prev.title}
          </Link>
        ) : (
          <Link className="btn" href={base}>
            ← Overview
          </Link>
        )}
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium">
          <input type="checkbox" className="h-4 w-4 accent-[var(--good)]" checked={state.status === "complete"} onChange={(e) => toggleComplete(stepKey, e.target.checked)} />
          Mark step as reviewed &amp; complete
          {state.fails > 0 && <span className="text-xs font-normal text-bad">({state.fails} failing check{state.fails > 1 ? "s" : ""})</span>}
        </label>
        {next ? (
          <Link className="btn btn-primary" href={`${base}/${next.key}`}>
            {next.title} →
          </Link>
        ) : (
          <Link className="btn btn-primary" href={base}>
            Overview →
          </Link>
        )}
      </div>
    </div>
  );
}

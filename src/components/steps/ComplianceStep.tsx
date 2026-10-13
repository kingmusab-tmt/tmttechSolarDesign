"use client";

import type { Check } from "@/lib/calc";
import { COMPLIANCE_GROUPS, COMPLIANCE_ITEMS, type ComplianceItem } from "@/lib/compliance";
import { Badge, Card, Field, ProgressBar, TextInput } from "../ui";
import { useProject } from "../project/ProjectProvider";
import { useSection } from "./shared";

/** Resolve the engine's automatic verification for a checklist item ("cab-*" matches a prefix). */
export function autoStatus(item: ComplianceItem, checks: Check[]): Check["status"] | null {
  if (!item.autoCheck) return null;
  const matched = item.autoCheck.endsWith("*") ? checks.filter((c) => c.id.startsWith(item.autoCheck!.slice(0, -1))) : checks.filter((c) => c.id === item.autoCheck);
  if (!matched.length) return null;
  if (matched.some((c) => c.status === "fail")) return "fail";
  if (matched.some((c) => c.status === "warn")) return "warn";
  return "pass";
}

export function ComplianceStep() {
  const { results } = useProject();
  const [comp, setComp] = useSection("compliance");
  const done = COMPLIANCE_ITEMS.filter((i) => comp.items[i.key]?.checked).length;
  const setItem = (key: string, patch: Partial<{ checked: boolean; notes: string }>) => {
    const prev = comp.items[key] ?? { checked: false, notes: "" };
    setComp({ items: { ...comp.items, [key]: { ...prev, ...patch } } });
  };

  return (
    <div className="space-y-6">
      <Card title="Compliance progress" subtitle={`${done} of ${COMPLIANCE_ITEMS.length} items verified`}>
        <ProgressBar pct={(done / COMPLIANCE_ITEMS.length) * 100} />
      </Card>

      {COMPLIANCE_GROUPS.map((g) => (
        <Card key={g} title={g} bodyClassName="p-0">
          <ul className="divide-y divide-line">
            {COMPLIANCE_ITEMS.filter((i) => i.group === g).map((i) => {
              const st = autoStatus(i, results.checks);
              const v = comp.items[i.key] ?? { checked: false, notes: "" };
              return (
                <li key={i.key} className="grid gap-3 px-5 py-3 md:grid-cols-[1fr_260px]">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" checked={v.checked} onChange={(e) => setItem(i.key, { checked: e.target.checked })} />
                    <span>
                      <span className="block text-sm font-medium">{i.label}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                        {i.standard}
                        {st === "pass" && <Badge tone="good">✓ Auto-verified</Badge>}
                        {st === "warn" && <Badge tone="warn">! Design warning</Badge>}
                        {st === "fail" && <Badge tone="bad">✕ Design fails check</Badge>}
                      </span>
                    </span>
                  </label>
                  <input className="input py-1.5 text-xs" placeholder="Notes / evidence reference" value={v.notes} onChange={(e) => setItem(i.key, { notes: e.target.value })} />
                </li>
              );
            })}
          </ul>
        </Card>
      ))}

      <Card title="Engineer's sign-off" subtitle="Required before the design is issued for construction">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Engineer's name">
            <TextInput value={comp.engineerName} onChange={(engineerName) => setComp({ engineerName })} />
          </Field>
          <Field label="COREN registration number">
            <TextInput value={comp.corenNumber} onChange={(corenNumber) => setComp({ corenNumber })} />
          </Field>
          <Field label="Sign-off date">
            <TextInput type="date" value={comp.signOffDate} onChange={(signOffDate) => setComp({ signOffDate })} />
          </Field>
        </div>
      </Card>
    </div>
  );
}

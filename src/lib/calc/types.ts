import type { StepKey } from "../schemas";

export type CheckStatus = "pass" | "warn" | "fail" | "info";

export interface Check {
  id: string;
  step: StepKey;
  label: string;
  status: CheckStatus;
  detail: string;
}

export function check(step: StepKey, id: string, label: string, ok: boolean, detail: string, failStatus: CheckStatus = "fail"): Check {
  return { id, step, label, status: ok ? "pass" : failStatus, detail };
}

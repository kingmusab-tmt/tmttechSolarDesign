import { notFound } from "next/navigation";
import { StepView } from "@/components/project/StepView";
import { STEP_KEYS, type StepKey } from "@/lib/schemas";

export default async function StepPage({ params }: { params: Promise<{ id: string; step: string }> }) {
  const { step } = await params;
  if (!(STEP_KEYS as readonly string[]).includes(step)) notFound();
  return <StepView stepKey={step as StepKey} />;
}

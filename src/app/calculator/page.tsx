import type { Metadata } from "next";
import { QuickCalculator } from "@/components/QuickCalculator";

export const metadata: Metadata = { title: "Quick sizing calculator" };

export default function CalculatorPage() {
  return <QuickCalculator />;
}

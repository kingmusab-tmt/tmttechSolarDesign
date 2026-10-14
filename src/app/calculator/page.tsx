import type { Metadata } from "next";
import { publicPage } from "@/lib/seo";
import { QuickCalculator } from "@/components/QuickCalculator";

export const metadata: Metadata = publicPage("/calculator", "Free Solar Sizing Calculator", "Size a solar home system in seconds: enter your daily energy use and get the inverter, battery bank, PV array and charge controller sizes. Free, no sign-up, works offline.");

export default function CalculatorPage() {
  return <QuickCalculator />;
}

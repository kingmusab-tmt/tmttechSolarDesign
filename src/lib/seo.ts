import type { Metadata } from "next";
import { APP_NAME, COMPANY } from "./brand";

/** Public address of the site: set NEXT_PUBLIC_SITE_URL in production (e.g. https://solar.example.com). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")).replace(/\/+$/, "");

export const SITE_DESCRIPTION =
  "Free solar home system design software for engineers and installers in Nigeria: load audit, inverter, battery and PV sizing, temperature-corrected string design, cable sizing, single-line diagrams, array layout, Bill of Quantities and financial analysis. Works offline.";

export const KEYWORDS = [
  "solar home system design",
  "solar PV sizing calculator",
  "solar design software Nigeria",
  "inverter sizing",
  "battery bank sizing",
  "PV string sizing",
  "solar cable sizing",
  "single line diagram solar",
  "solar bill of quantities",
  "off-grid solar design",
  "hybrid inverter design",
  "solar installer tool",
  "COREN solar design",
  "IEC 62548",
  APP_NAME,
  COMPANY.name,
];

/** Pages behind sign-in: never indexed, links not followed. */
export const PRIVATE: Metadata["robots"] = { index: false, follow: false, nocache: true };

/** Metadata for a public page: title, description and a canonical URL with matching share cards. */
export function publicPage(path: string, title: string, description: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title: `${title} · ${APP_NAME}`, description, url: path },
    twitter: { title: `${title} · ${APP_NAME}`, description },
  };
}

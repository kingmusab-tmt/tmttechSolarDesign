import Link from "next/link";
import { APP_NAME, COMPANY } from "@/lib/brand";
import { Logo } from "./Logo";

const A = "text-text underline-offset-2 hover:text-accent-strong hover:underline";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="no-print mt-16 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-8 px-4 py-10 text-sm sm:px-6 md:grid-cols-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-semibold">
            <Logo className="h-6 w-6" />
            {APP_NAME}
          </div>
          <p className="text-muted">
            An idea by{" "}
            <a className={`font-medium ${A}`} href={COMPANY.website} target="_blank" rel="noopener noreferrer">
              {COMPANY.name}
            </a>
          </p>
          <p className="text-muted">
            CEO: <span className="text-text">{COMPANY.ceo}</span>
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Contact</h2>
          <ul className="space-y-1.5">
            <li>
              <a className={`break-all ${A}`} href={COMPANY.website} target="_blank" rel="noopener noreferrer">
                {COMPANY.websiteLabel}
              </a>
            </li>
            {COMPANY.emails.map((e) => (
              <li key={e}>
                <a className={`break-all ${A}`} href={`mailto:${e}`}>
                  {e}
                </a>
              </li>
            ))}
            <li className="flex flex-wrap gap-x-3 gap-y-1">
              {COMPANY.phones.map((p) => (
                <a key={p.tel} className={`whitespace-nowrap ${A}`} href={`tel:${p.tel}`}>
                  {p.label}
                </a>
              ))}
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Data & credits</h2>
          <p className="text-muted">
            Site location: NIPOST digital postcodes (Nigerian Postal Service). Maps: Esri World Imagery and © OpenStreetMap contributors. Climate data: NASA POWER (NASA Langley Research Center) and Global Solar Atlas 2.0 (World Bank Group, Solargis, ESMAP). PV module data: California Energy Commission list via NREL System Advisor Model.
          </p>
          <Link href="/credits" className={`font-medium ${A}`}>
            Full attributions and licences →
          </Link>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-[1400px] px-4 py-4 text-xs text-muted sm:px-6">
          © {year} {COMPANY.name}. All rights reserved. Product names and trademarks belong to their respective owners.
        </p>
      </div>
    </footer>
  );
}

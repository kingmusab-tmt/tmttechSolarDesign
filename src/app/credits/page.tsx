import type { Metadata } from "next";
import { publicPage } from "@/lib/seo";
import { APP_NAME, BSD_3_CLAUSE, COMPANY, DATA_CREDITS, SOFTWARE_CREDITS } from "@/lib/brand";

export const metadata: Metadata = publicPage("/credits", "Credits and attributions", "Data sources, licences and open-source software behind the solar design app: NIPOST digital postcodes, NASA POWER, Global Solar Atlas, the CEC module list via NREL SAM, and more.");

export default function CreditsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold">Credits and attributions</h1>
        <p className="mt-1 text-sm text-muted">
          {APP_NAME} is an idea by{" "}
          <a className="text-accent-strong underline" href={COMPANY.website} target="_blank" rel="noopener noreferrer">
            {COMPANY.name}
          </a>{" "}
          (CEO: {COMPANY.ceo}). It builds on the following data and software, credited as their providers request.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Data sources</h2>
        {DATA_CREDITS.map((d) => (
          <div key={d.name} className="card space-y-1.5 p-4 text-sm">
            <h3 className="font-semibold">
              {d.url ? (
                <a className="underline-offset-2 hover:text-accent-strong hover:underline" href={d.url} target="_blank" rel="noopener noreferrer">
                  {d.name} ↗
                </a>
              ) : (
                d.name
              )}
            </h3>
            <p className="text-muted">{d.use}</p>
            <p>{d.attribution}</p>
            <p className="text-xs text-muted">
              <span className="font-medium">Licence:</span>{" "}
              {d.license.url ? (
                <a className="underline underline-offset-2 hover:text-accent-strong" href={d.license.url} target="_blank" rel="noopener noreferrer">
                  {d.license.label}
                </a>
              ) : (
                d.license.label
              )}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">BSD 3-Clause License (NREL System Advisor Model data)</h2>
        <div className="card p-4">
          <p className="mb-3 text-sm font-medium">Copyright © Alliance for Sustainable Energy, LLC. All rights reserved.</p>
          <p className="text-xs leading-relaxed whitespace-pre-line text-muted">{BSD_3_CLAUSE}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Open-source software</h2>
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Licence</th>
              </tr>
            </thead>
            <tbody>
              {SOFTWARE_CREDITS.map((s) => (
                <tr key={s.name}>
                  <td>
                    <a className="underline-offset-2 hover:text-accent-strong hover:underline" href={s.url} target="_blank" rel="noopener noreferrer">
                      {s.name}
                    </a>
                  </td>
                  <td className="text-muted">{s.license}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">Each project&apos;s full licence text ships with its package.</p>
      </section>

      <section className="space-y-2 text-sm">
        <h2 className="text-lg font-semibold">Standards referenced</h2>
        <p className="text-muted">
          Design checks refer by number to IEC standards (including IEC 62548, IEC 60364-7-712, IEC 62446-1, IEC 61215/61730, IEC 62109, IEC 61643 and IEC 62619), EN 50618, and Nigerian requirements from COREN, NEMSA, SON (SONCAP) and the National Building Code. The
          standards belong to their publishers (IEC, CENELEC and the Nigerian bodies above); this app only cites them and does not reproduce their text.
        </p>
      </section>
    </main>
  );
}

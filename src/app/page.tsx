import Link from "next/link";
import { redirect } from "next/navigation";
import { APP_NAME, COMPANY } from "@/lib/brand";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/seo";
import { getSession } from "@/lib/server/auth";
import { STEPS } from "@/lib/steps";

/** Structured data so search engines understand the app and who publishes it. */
function jsonLd() {
  const org = {
    "@type": "Organization",
    "@id": `${COMPANY.website}#organization`,
    name: COMPANY.name,
    url: COMPANY.website,
    email: COMPANY.emails[1],
    founder: { "@type": "Person", name: COMPANY.ceo, jobTitle: "CEO" },
    contactPoint: COMPANY.phones.map((p) => ({ "@type": "ContactPoint", telephone: p.tel, contactType: "customer support", areaServed: "NG", availableLanguage: "English" })),
  };
  const app = {
    "@type": "WebApplication",
    "@id": `${SITE_URL}/#app`,
    name: APP_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    applicationCategory: "EngineeringApplication",
    operatingSystem: "Any (web browser, installable PWA)",
    browserRequirements: "Requires JavaScript",
    offers: { "@type": "Offer", price: "0", priceCurrency: "NGN" },
    featureList: STEPS.map((st) => st.title),
    publisher: { "@id": org["@id"] },
    creator: { "@id": org["@id"] },
  };
  const site = { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: APP_NAME, url: SITE_URL, publisher: { "@id": org["@id"] }, inLanguage: "en-NG" };
  // Escape "<" so the JSON can never close the script element.
  return JSON.stringify({ "@context": "https://schema.org", "@graph": [org, app, site] }).replace(/</g, "\\u003c");
}

export default async function Home() {
  if (await getSession()) redirect("/dashboard");
  const phases = ["Sizing", "Engineering", "Deliverables"] as const;
  return (
    <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd() }} />
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

      <h2 className="mt-16 text-2xl font-bold tracking-tight">From load audit to signed-off design in {STEPS.length} steps</h2>
      <p className="mt-2 max-w-3xl text-muted">Each step checks the design against IEC standards and Nigerian requirements, so problems surface before installation, not after.</p>
      <section className="mt-6 grid gap-6 md:grid-cols-3">
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

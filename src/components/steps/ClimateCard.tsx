"use client";

import { useState } from "react";
import { DISAGREEMENT_PCT, MONTH_LABELS, combineClimate, gsaSiteUrl, parsePastedMonthly, type NasaClimate } from "@/lib/climate";
import { fmt } from "@/lib/format";
import type { Site } from "@/lib/schemas";
import { MonthlyChart } from "../charts/MonthlyChart";
import { Badge, Card, Field, NumInput, cx } from "../ui";
import { useSection } from "./shared";

type Detail = Site["climateDetail"];
const DAYS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Recombine the climate sources into a site patch with the automatic design basis. */
export function climatePatch(site: Site, next: Detail, extra: Partial<Site> = {}): Partial<Site> {
  const hasAny = next.gsaPsh.length === 12 || next.nasaPsh.length === 12;
  if (!hasAny) return { ...extra, monthlyPsh: [], climateSource: "Location preset", climateDetail: { ...next, method: "none", disagreeMonths: [] } };
  const c = combineClimate(next.gsaPsh, next.nasaPsh);
  const lat = extra.latitude ?? site.latitude;
  const lon = extra.longitude ?? site.longitude;
  // Off-grid systems must survive the worst month; with grid/generator backup the annual average right-sizes the array.
  const gridAvailable = extra.gridAvailable ?? site.gridAvailable;
  return {
    ...extra,
    monthlyPsh: c.monthlyPsh,
    peakSunHours: gridAvailable ? c.annualPsh : c.worstMonth.value,
    climateSource: `${c.source} · ${lat}°, ${lon}°`,
    climateDetail: { ...next, method: c.method, disagreeMonths: c.disagreeMonths, fetchedAt: new Date().toISOString() },
  };
}

export async function fetchNasaClimate(lat: number, lon: number): Promise<NasaClimate> {
  const res = await fetch(`/api/climate?lat=${lat}&lon=${lon}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not fetch NASA POWER data");
  return data.nasa as NasaClimate;
}

/**
 * Site climate: NASA POWER is fetched automatically; Global Solar Atlas values are entered by the
 * engineer (its terms forbid automated access). When both exist, each month is their average.
 */
export function ClimateCard() {
  const [site, setSite] = useSection("site");
  const detail = site.climateDetail;
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const [showGsa, setShowGsa] = useState(false);
  const [ghiText, setGhiText] = useState("");
  const [pvoutText, setPvoutText] = useState("");
  const [tilt, setTilt] = useState(detail.optimalTiltDeg);
  const [gsaError, setGsaError] = useState("");
  const [gsaNote, setGsaNote] = useState("");

  /** Recombine the sources and apply the automatic design basis. */
  function apply(next: Detail, extra: Partial<Site> = {}) {
    setSite(climatePatch(site, next, extra));
  }

  async function fetchNasa() {
    setFetching(true);
    setError("");
    try {
      const n = await fetchNasaClimate(site.latitude, site.longitude);
      apply({ ...detail, nasaPsh: n.monthlyPsh }, { tMin: n.tMin, tMax: n.tMax });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not fetch NASA POWER data");
    } finally {
      setFetching(false);
    }
  }

  function applyGsa() {
    setGsaError("");
    setGsaNote("");
    try {
      const ghi = parsePastedMonthly(ghiText);
      const notes = [ghi.convertedFromTotals ? "Irradiance looked like monthly totals and was converted to daily values." : ""];
      let gsaPvoutPerDay: number[] = [];
      let gsaAnnualPvout = 0;
      if (pvoutText.trim()) {
        const pv = parsePastedMonthly(pvoutText, 10);
        gsaPvoutPerDay = pv.perDay;
        gsaAnnualPvout = Math.round(pv.perDay.reduce((a, v, i) => a + v * DAYS[i], 0));
        if (pv.convertedFromTotals) notes.push("PV output looked like monthly totals and was converted to daily values.");
      }
      apply({ ...detail, gsaPsh: ghi.perDay, gsaPvoutPerDay, gsaAnnualPvout, optimalTiltDeg: tilt });
      setGsaNote(notes.filter(Boolean).join(" ") || "Global Solar Atlas values applied.");
      setShowGsa(false);
    } catch (e) {
      setGsaError(e instanceof Error ? e.message : "Could not read the values");
    }
  }

  const monthly = site.monthlyPsh.length === 12 ? site.monthlyPsh : null;
  const annual = monthly ? round2(monthly.reduce((a, v) => a + v, 0) / 12) : 0;
  const worstIdx = monthly ? monthly.indexOf(Math.min(...monthly)) : -1;
  const hasGsa = detail.gsaPsh.length === 12;
  const hasNasa = detail.nasaPsh.length === 12;

  return (
    <Card
      title="Climate data"
      subtitle={monthly ? site.climateSource : "NASA POWER (automatic) + Global Solar Atlas (entered by you): averaged month by month when both are present"}
      className="xl:col-span-2"
      actions={
        <>
          <button className="btn btn-sm" onClick={() => setShowGsa((v) => !v)}>
            {hasGsa ? "Edit Global Solar Atlas values" : "+ Global Solar Atlas values"}
          </button>
          <button className="btn btn-primary btn-sm" onClick={fetchNasa} disabled={fetching}>
            {fetching ? "Fetching…" : hasNasa ? "Refresh NASA POWER" : "Fetch NASA POWER"}
          </button>
        </>
      }
    >
      {error && <p className="mb-3 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      {gsaNote && <p className="mb-3 rounded-lg bg-good-soft px-3 py-2 text-sm text-good">{gsaNote}</p>}

      {showGsa && (
        <div className="mb-5 space-y-4 rounded-xl border border-line bg-surface-2 p-4">
          <div className="text-sm">
            <p className="font-medium">Enter values from Global Solar Atlas</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs text-muted">
              <li>
                <a className="font-medium text-accent-strong underline" href={gsaSiteUrl(site.latitude, site.longitude)} target="_blank" rel="noopener noreferrer">
                  Open this site on Global Solar Atlas ↗
                </a>{" "}
                (it opens at this project&apos;s coordinates).
              </li>
              <li>In the site panel, find the monthly averages (on screen, or in the report you can download from the site).</li>
              <li>Copy the 12 monthly GHI values (Jan → Dec) and paste them below. Daily values (≈ 4.8) or monthly totals (≈ 148 kWh/m²) both work.</li>
            </ol>
          </div>
          <Field label="Global horizontal irradiation (GHI): 12 monthly values *">
            <textarea className="input min-h-16 font-mono text-xs" value={ghiText} onChange={(e) => setGhiText(e.target.value)} placeholder="147.6  140.5  157.1  154.5  157.1  138.8  121.4  112.5  129.4  147.1  160.5  159.1" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <Field label="PV output (PVOUT, kWh/kWp): 12 monthly values (optional)" hint="Enables the yield cross-check against Solargis' PV simulation">
              <textarea className="input min-h-16 font-mono text-xs" value={pvoutText} onChange={(e) => setPvoutText(e.target.value)} placeholder="121.9  113.3  123.6  119.3  119.5  105.5  93.6  88.1  103.3  120.3  134.2  133.6" />
            </Field>
            <Field label="Optimum tilt (optional)">
              <NumInput value={tilt} min={0} max={90} onChange={setTilt} suffix="°" />
            </Field>
          </div>
          {gsaError && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{gsaError}</p>}
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary btn-sm" onClick={applyGsa} disabled={!ghiText.trim()}>
              Apply values
            </button>
            {hasGsa && (
              <button className="btn btn-sm text-bad" onClick={() => apply({ ...detail, gsaPsh: [], gsaPvoutPerDay: [], gsaAnnualPvout: 0, optimalTiltDeg: 0 })}>
                Remove Global Solar Atlas values
              </button>
            )}
            <button className="btn btn-sm" onClick={() => setShowGsa(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {!monthly ? (
        <p className="text-sm text-muted">
          Currently using {site.climateSource.toLowerCase()} values. Fetch NASA POWER for 12-month satellite data and record temperatures, then add the Global Solar Atlas values to average the two sources.
        </p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {detail.method === "average" && <Badge tone="good">✓ Both sources: monthly average</Badge>}
            {detail.method === "nasa" && <Badge tone="info">NASA POWER only: add Global Solar Atlas values to average</Badge>}
            {detail.method === "gsa" && <Badge tone="warn">Global Solar Atlas only: fetch NASA POWER for record temperatures</Badge>}
            {detail.optimalTiltDeg > 0 && <Badge tone="info">Optimum tilt {detail.optimalTiltDeg}° (Solargis)</Badge>}
            {detail.gsaAnnualPvout > 0 && <Badge tone="info">Specific yield {fmt(detail.gsaAnnualPvout)} kWh/kWp/yr</Badge>}
            {detail.disagreeMonths.length > 0 && <Badge tone="warn">Sources differ &gt; {DISAGREEMENT_PCT} % in {detail.disagreeMonths.map((i) => MONTH_LABELS[i]).join(", ")}: check the entered values</Badge>}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <MonthlyChart title="Design peak sun hours by month" values={monthly} unit="h/day" highlight={worstIdx} reference={{ value: site.peakSunHours, label: `Design ${site.peakSunHours} h` }} />
            <div className="space-y-3 text-sm">
              <p className="text-muted">
                Design basis applied automatically: <strong className="text-text">{site.gridAvailable ? "annual average" : "worst month"}</strong> ({site.gridAvailable ? "grid/generator backup available" : "off-grid reliability"}). Switch if needed:
              </p>
              <button className={cx("btn w-full justify-between", site.peakSunHours === monthly[worstIdx] && "border-accent")} onClick={() => setSite({ peakSunHours: monthly[worstIdx] })}>
                <span>Worst month ({MONTH_LABELS[worstIdx]})</span>
                <span className="num font-semibold">{monthly[worstIdx].toFixed(2)} h</span>
              </button>
              <button className={cx("btn w-full justify-between", Math.abs(site.peakSunHours - annual) < 0.005 && "border-accent")} onClick={() => setSite({ peakSunHours: annual })}>
                <span>Annual average</span>
                <span className="num font-semibold">{annual.toFixed(2)} h</span>
              </button>
              <p className="text-xs text-muted">
                Record temperatures: Tmin {site.tMin} °C, Tmax {site.tMax} °C {hasNasa ? "(NASA POWER extremes)" : "(preset values: fetch NASA POWER to update)"}. Check against local records for the string-voltage limit.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table min-w-[760px] text-xs">
              <thead>
                <tr>
                  <th>Peak sun hours (h/day)</th>
                  {MONTH_LABELS.map((m) => (
                    <th key={m} className="text-right">
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hasGsa && (
                  <tr>
                    <td className="text-muted">Global Solar Atlas (entered)</td>
                    {detail.gsaPsh.map((v, i) => (
                      <td key={i} className="num text-right">
                        {v.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                )}
                {hasNasa && (
                  <tr>
                    <td className="text-muted">NASA POWER</td>
                    {detail.nasaPsh.map((v, i) => (
                      <td key={i} className="num text-right">
                        {v.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                )}
                <tr className="font-semibold">
                  <td>{detail.method === "average" ? "Average (used)" : "Used"}</td>
                  {monthly.map((v, i) => (
                    <td key={i} className={cx("num text-right", detail.disagreeMonths.includes(i) && "text-warn")}>
                      {v.toFixed(2)}
                    </td>
                  ))}
                </tr>
                {detail.gsaPvoutPerDay.length === 12 && (
                  <tr>
                    <td className="text-muted">Solargis PV output (kWh/kWp/day)</td>
                    {detail.gsaPvoutPerDay.map((v, i) => (
                      <td key={i} className="num text-right text-muted">
                        {v.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted">
            {hasGsa && "Global Solar Atlas 2.0, © World Bank Group / Solargis (CC BY 4.0), values entered by the user. "}
            {hasNasa && "NASA POWER, NASA Langley Research Center. "}
            Long-term averages for the coordinates; on-site conditions may differ.
          </p>
        </div>
      )}
    </Card>
  );
}

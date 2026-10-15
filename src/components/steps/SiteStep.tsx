"use client";

import { fmt } from "@/lib/format";
import { LOCATIONS, findLocation } from "@/lib/locations";
import { Card, Field, KeyValue, NumInput, Select, TextInput, Toggle, cx } from "../ui";
import { useProject } from "../project/ProjectProvider";
import { ClimateCard } from "./ClimateCard";
import { NipostLocation } from "./NipostLocation";
import { useSection } from "./shared";

export function SiteStep() {
  const { results } = useProject();
  const [client, setClient] = useSection("client");
  const [site, setSite] = useSection("site");

  const applyPreset = (key: string) => {
    const l = findLocation(key);
    if (!l) return setSite({ locationPreset: "custom" });
    setSite({ locationPreset: l.key, city: l.city, state: l.state, latitude: l.latitude, longitude: l.longitude, peakSunHours: l.peakSunHours, tMin: l.tMin, tMax: l.tMax, monthlyPsh: [], climateSource: "Location preset", climateDetail: { ...site.climateDetail, method: "none", gsaPsh: [], nasaPsh: [], gsaPvoutPerDay: [], gsaAnnualPvout: 0, optimalTiltDeg: 0, disagreeMonths: [], fetchedAt: "" } });
  };


  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card title="Client" subtitle="Who the system is designed for">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client name">
            <TextInput value={client.name} onChange={(name) => setClient({ name })} />
          </Field>
          <Field label="Phone">
            <TextInput value={client.phone} onChange={(phone) => setClient({ phone })} type="tel" />
          </Field>
          <Field label="Email" className="sm:col-span-2">
            <TextInput value={client.email} onChange={(email) => setClient({ email })} type="email" />
          </Field>
          <Field label="Installation address" className="sm:col-span-2">
            <TextInput value={client.address} onChange={(address) => setClient({ address })} />
          </Field>
        </div>
      </Card>

      <Card title="Location & climate" subtitle="Drives PV yield (peak sun hours) and string voltage limits (temperatures)">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <span className="label">How to locate the site</span>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="How to locate the site">
              {(
                [
                  ["nipost", "NIPOST digital postcode", "Identify the exact building by its postcode and pin it (GPS, map or the client's phone)"],
                  ["preset", "City preset & coordinates", "Pick the nearest city or type latitude and longitude"],
                ] as const
              ).map(([value, title, desc]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={site.locationMethod === value}
                  onClick={() => setSite({ locationMethod: value })}
                  className={cx("rounded-xl border p-3 text-left transition-colors", site.locationMethod === value ? "border-accent bg-accent-soft/50" : "border-line hover:border-accent/60")}
                >
                  <div className="text-sm font-semibold">{title}</div>
                  <div className="mt-0.5 text-xs text-muted">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {site.locationMethod === "nipost" ? (
            <NipostLocation />
          ) : (
            <>
              <Field label="Location preset" className="sm:col-span-2" hint="Indicative values. Verify against PVGIS or NASA POWER for the exact coordinates.">
                <Select
                  value={site.locationPreset}
                  onChange={applyPreset}
                  options={[...LOCATIONS.map((l) => ({ value: l.key, label: `${l.city}, ${l.state}` })), { value: "custom", label: "Custom location" }]}
                />
              </Field>
            </>
          )}
          <Field label={site.locationMethod === "nipost" ? "Town / locality" : "City / town"}>
            <TextInput value={site.city} onChange={(city) => setSite({ city, locationPreset: "custom" })} />
          </Field>
          <Field label="State">
            <TextInput value={site.state} onChange={(state) => setSite({ state })} />
          </Field>
          {site.locationMethod !== "nipost" && (
            <>
              <Field label="Latitude">
                <NumInput value={site.latitude} min={-90} max={90} onChange={(latitude) => setSite({ latitude })} suffix="°" />
              </Field>
              <Field label="Longitude">
                <NumInput value={site.longitude} min={-180} max={180} onChange={(longitude) => setSite({ longitude })} suffix="°" />
              </Field>
            </>
          )}
          <Field label="Peak sun hours (design month)" hint="Nigeria: about 4 h (south) to 6+ h (far north). Use the worst month for off-grid reliability.">
            <NumInput value={site.peakSunHours} min={0.5} max={12} onChange={(peakSunHours) => setSite({ peakSunHours })} suffix="h/day" />
          </Field>
          <div />
          <Field label="Record low temperature (Tmin)" hint="Sets the maximum string Voc">
            <NumInput value={site.tMin} min={-60} max={50} onChange={(tMin) => setSite({ tMin })} suffix="°C" />
          </Field>
          <Field label="Record high temperature (Tmax)" hint="Sets the minimum string Vmp">
            <NumInput value={site.tMax} min={-20} max={60} onChange={(tMax) => setSite({ tMax })} suffix="°C" />
          </Field>
          <div className="sm:col-span-2">
            <Toggle checked={site.gridAvailable} onChange={(gridAvailable) => setSite({ gridAvailable })} label="Grid or generator supply available (adds AC input, changeover and the busbar check)" />
          </div>
          <Field label="Site notes" className="sm:col-span-2">
            <textarea className="input min-h-20" value={site.notes} onChange={(e) => setSite({ notes: e.target.value })} />
          </Field>
        </div>
      </Card>

      <ClimateCard />

      <Card title="Solar geometry" subtitle="Derived from the latitude" className="xl:col-span-2">
        <KeyValue
          rows={[
            ["Recommended tilt (≈ latitude, minimum 10° for self-cleaning)", `${results.site.recommendedTiltDeg}°`],
            ["Recommended azimuth (face the equator)", `${results.site.recommendedAzimuthDeg}° (${results.site.recommendedAzimuthDeg === 180 ? "south" : "north"})`],
            ["Minimum noon sun altitude (December solstice)", `${fmt(results.site.minNoonAltitudeDeg, 1)}°`],
          ]}
        />
      </Card>
    </div>
  );
}

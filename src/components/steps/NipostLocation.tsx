"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LOCATIONS } from "@/lib/locations";
import { LOCATION_SOURCE_LABELS, canonicalPostcode, distanceM, inNigeria, parsePostcode, pinMatch, round6, type LocationSource } from "@/lib/postcode";
import type { Site } from "@/lib/schemas";
import { currentPosition, pickWithWidget, placeCentre, reverseLookup, validatePostcode, widgetEnabled, type ReverseResult } from "../location/nipost-client";
import type { LatLng } from "../location/LocationMap";
import { useProject } from "../project/ProjectProvider";
import { Badge, Field, NumInput, cx } from "../ui";
import { climatePatch, fetchNasaClimate } from "./ClimateCard";
import { useSection } from "./shared";

const LocationMap = dynamic(() => import("../location/LocationMap").then((m) => m.LocationMap), {
  ssr: false,
  loading: () => <div className="flex h-80 items-center justify-center rounded-xl border border-line bg-surface-2 text-sm text-muted">Loading map…</div>,
});

type Draft = LatLng & { accuracyM: number; source: Exclude<LocationSource, "">; check: ReverseResult | null; checking: boolean; checkError: string };

const EMPTY_DETAIL: Site["climateDetail"] = { method: "none", gsaPsh: [], nasaPsh: [], gsaPvoutPerDay: [], gsaAnnualPvout: 0, optimalTiltDeg: 0, disagreeMonths: [], fetchedAt: "" };

function nearestPreset(lat: number, lng: number) {
  return LOCATIONS.reduce((best, l) => (distanceM(lat, lng, l.latitude, l.longitude) < distanceM(lat, lng, best.latitude, best.longitude) ? l : best));
}

const fmtCoord = (v: number) => v.toFixed(6);

/**
 * NIPOST location method: identify the building by its digital postcode, then fix its coordinates
 * by GPS, a map pin or the client's own phone. NIPOST's reverse lookup confirms the pin is on the
 * same building before the coordinates drive NASA POWER and the solar geometry.
 */
export function NipostLocation() {
  const { project } = useProject();
  const [site, setSite] = useSection("site");
  const [client, setClient] = useSection("client");
  const np = site.nipost;

  const [code, setCode] = useState(np.postcode);
  const [codeMsg, setCodeMsg] = useState<{ tone: "good" | "bad" | "warn" | "info"; text: string } | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);
  const [widgetBusy, setWidgetBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [applying, setApplying] = useState("");
  const [area, setArea] = useState<LatLng | null>(null);
  const [manual, setManual] = useState(false);

  useEffect(() => setCode(np.postcode), [np.postcode]);

  const located = np.source !== "";
  const saved: LatLng | null = located ? { lat: site.latitude, lng: site.longitude } : null;

  // Open the map on the postcode's LGA until a building is pinned.
  const lgaQuery = np.lga && site.state ? `${np.lga}, ${site.state}` : "";
  useEffect(() => {
    if (located || !lgaQuery) return;
    let alive = true;
    placeCentre(lgaQuery)
      .then((c) => alive && c && setArea({ lat: c.lat, lng: c.lon }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [lgaQuery, located]);

  const centre = useMemo<LatLng>(() => saved ?? area ?? { lat: site.latitude, lng: site.longitude }, [saved?.lat, saved?.lng, area, site.latitude, site.longitude]); // eslint-disable-line react-hooks/exhaustive-deps
  const mapZoom = saved ? 19 : area ? 14 : 12;

  /* ---------------- 1. postcode ---------------- */

  async function checkPostcode(input = code) {
    setCodeMsg(null);
    const p = parsePostcode(input);
    if (!p) {
      setCodeMsg({ tone: "bad", text: "Not a NIPOST postcode. Format: state, LGA, district, area, building, e.g. FC-02-A09-DB-09" });
      return;
    }
    setCode(p.formatted);
    setCheckingCode(true);
    try {
      const r = await validatePostcode(p.formatted);
      const names = { ...(r.stateName ? { state: r.stateName } : {}), ...(r.lgaName ? { city: r.lgaName } : {}) };
      setSite({ ...names, nipost: { ...np, postcode: r.postcode, validity: r.valid === null ? "unchecked" : r.valid ? "valid" : "invalid", lga: r.lgaName || np.lga } });
      if (!r.configured) setCodeMsg({ tone: "warn", text: "Format is correct. NIPOST checking is not set up on this server, so the postcode was not verified." });
      else if (r.valid) setCodeMsg({ tone: "good", text: `NIPOST confirms this postcode${r.lgaName ? ` · ${r.lgaName}, ${r.stateName}` : ""}. Now pin the building below.` });
      else setCodeMsg({ tone: "bad", text: "NIPOST does not recognise this postcode. Check it with the client (it is shown in their NIPOST Postcode app)." });
    } catch (e) {
      setCodeMsg({ tone: "bad", text: e instanceof Error ? e.message : "Could not check the postcode" });
    } finally {
      setCheckingCode(false);
    }
  }

  async function openWidget() {
    setError("");
    setWidgetBusy(true);
    try {
      const sel = await pickWithWidget();
      if (!sel) return;
      if (sel.temporary) {
        setCodeMsg({ tone: "warn", text: `The building has no postcode yet (temporary reference ${sel.formatted}). Pin it on the map; NIPOST will assign a postcode later.` });
        return;
      }
      const formatted = canonicalPostcode(sel.formatted || sel.postcode);
      setCode(formatted);
      setSite({
        ...(sel.names?.state ? { state: sel.names.state } : {}),
        ...(sel.names?.lga ? { city: sel.names.lga } : {}),
        nipost: { ...np, postcode: formatted, validity: "valid", lga: sel.names?.lga || np.lga, address: sel.address || np.address },
      });
      if (sel.address && !client.address.trim()) setClient({ address: sel.address });
      setCodeMsg({ tone: "good", text: `Selected in NIPOST: ${formatted}${sel.address ? ` · ${sel.address}` : ""}. Now pin the building below.` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The NIPOST widget failed");
    } finally {
      setWidgetBusy(false);
    }
  }

  /* ---------------- 2. pin ---------------- */

  const placeDraft = useCallback((p: LatLng, source: Draft["source"], accuracyM = 0) => {
    setError("");
    if (!inNigeria(p.lat, p.lng)) {
      setError("That point is outside Nigeria. Move the pin onto the client's building.");
      return;
    }
    const lat = round6(p.lat);
    const lng = round6(p.lng);
    setDraft({ lat, lng, accuracyM, source, check: null, checking: true, checkError: "" });
    reverseLookup(lat, lng)
      .then((check) => setDraft((d) => (d && d.lat === lat && d.lng === lng ? { ...d, check, checking: false } : d)))
      .catch((e) => setDraft((d) => (d && d.lat === lat && d.lng === lng ? { ...d, checking: false, checkError: e instanceof Error ? e.message : "NIPOST check failed" } : d)));
  }, []);

  async function useGps() {
    setGpsBusy(true);
    setError("");
    try {
      const fix = await currentPosition();
      placeDraft(fix, "gps", fix.accuracyM);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not get the location");
    } finally {
      setGpsBusy(false);
    }
  }

  const onMapPick = useCallback((p: LatLng) => placeDraft(p, draft?.source === "client" ? "client" : "map"), [placeDraft, draft?.source]);

  /** Save the location, record the NIPOST check, and fetch NASA POWER for the new coordinates. */
  async function confirm(d: Draft) {
    setApplying("Saving location…");
    setError("");
    const c = d.check;
    const pinPostcode = c?.found ? canonicalPostcode(c.postcode ?? "") : "";
    const postcode = np.postcode || pinPostcode;
    // Provisional climate from the nearest city until NASA POWER answers (the readiness check flags presets).
    const near = nearestPreset(d.lat, d.lng);
    const patch: Partial<Site> = {
      latitude: d.lat,
      longitude: d.lng,
      locationPreset: "custom",
      ...(c?.stateName ? { state: c.stateName } : {}),
      ...(c?.locality || c?.lgaName ? { city: c.locality || c.lgaName } : {}),
      peakSunHours: near.peakSunHours,
      tMin: near.tMin,
      tMax: near.tMax,
      monthlyPsh: [],
      climateSource: `Location preset (nearest city: ${near.city})`,
      climateDetail: EMPTY_DETAIL,
      nipost: {
        ...np,
        postcode,
        validity: postcode === np.postcode ? np.validity : pinPostcode ? "valid" : np.validity,
        lga: c?.lgaName || np.lga,
        locality: c?.locality || np.locality,
        address: c?.address || np.address,
        source: d.source,
        accuracyM: d.accuracyM,
        pinChecked: Boolean(c?.configured),
        pinPostcode,
        pinDistanceM: c?.distanceM ?? 0,
        pinConfidence: c?.confidence ?? "",
        verifiedAt: new Date().toISOString(),
      },
    };
    setSite(patch);
    if (c?.address && !client.address.trim()) setClient({ address: c.address });
    setDraft(null);
    setApplying("Fetching NASA POWER climate data for the building…");
    try {
      const n = await fetchNasaClimate(d.lat, d.lng);
      setSite(climatePatch({ ...site, ...patch } as Site, { ...EMPTY_DETAIL, nasaPsh: n.monthlyPsh }, { tMin: n.tMin, tMax: n.tMax, latitude: d.lat, longitude: d.lng }));
      setApplying("");
    } catch (e) {
      setApplying("");
      setError(`Location saved, but NASA POWER failed: ${e instanceof Error ? e.message : "unknown error"}. Use “Fetch NASA POWER” in Climate data to retry.`);
    }
  }

  async function recheckSaved() {
    setError("");
    try {
      const c = await reverseLookup(site.latitude, site.longitude);
      if (!c.configured) return setError("NIPOST checking is not set up on this server.");
      setSite({ nipost: { ...np, pinChecked: true, pinPostcode: c.found ? canonicalPostcode(c.postcode ?? "") : "", pinDistanceM: c.distanceM ?? 0, pinConfidence: c.confidence ?? "", verifiedAt: new Date().toISOString() } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "NIPOST check failed");
    }
  }

  const draftMatch = draft?.check?.configured ? pinMatch(np.postcode, draft.check.found ? (draft.check.postcode ?? "") : "", true) : "unchecked";
  const savedMatch = pinMatch(np.postcode, np.pinPostcode, np.pinChecked);

  return (
    <div className="space-y-5 sm:col-span-2">
      {/* 1. Postcode */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">1. Building postcode</h3>
        <div className="flex flex-wrap gap-2">
          <input
            className="input min-w-0 flex-1 font-mono uppercase sm:max-w-60"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && checkPostcode()}
            placeholder="FC-02-A09-DB-09"
            aria-label="NIPOST digital postcode"
            autoComplete="postal-code"
          />
          <button type="button" className="btn" onClick={() => checkPostcode()} disabled={checkingCode || !code.trim()}>
            {checkingCode ? "Checking…" : "Check with NIPOST"}
          </button>
          {widgetEnabled && (
            <button type="button" className="btn" onClick={openWidget} disabled={widgetBusy}>
              {widgetBusy ? "Opening…" : "Find in NIPOST"}
            </button>
          )}
        </div>
        {codeMsg && <p className={cx("rounded-lg px-3 py-2 text-sm", { good: "bg-good-soft text-good", bad: "bg-bad-soft text-bad", warn: "bg-warn-soft text-warn", info: "bg-info-soft text-info" }[codeMsg.tone])}>{codeMsg.text}</p>}
        {!codeMsg && np.postcode && (
          <p className="text-xs text-muted">
            {np.postcode} · {np.validity === "valid" ? "confirmed by NIPOST" : np.validity === "invalid" ? "not recognised by NIPOST" : "not yet verified with NIPOST"}
            {np.lga && ` · ${np.lga}`}
            {np.address && ` · ${np.address}`}
          </p>
        )}
        <p className="text-xs text-muted">The client can find their postcode in the NIPOST Postcode app or at postcode.gov.ng. No postcode yet? Skip this: pinning the building below looks it up.</p>
      </div>

      {/* 2. Pin */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">2. Pin the building</h3>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-sm" onClick={useGps} disabled={gpsBusy}>
              {gpsBusy ? "Getting GPS fix…" : "📍 Use my location (on site)"}
            </button>
          </div>
        </div>
        <p className="text-xs text-muted">Tap the client&apos;s roof on the satellite map, drag the pin to fine-tune, or use your phone&apos;s GPS while standing at the building. Not on site? Send the client a location request below.</p>
        <LocationMap pin={draft ?? saved} centre={centre} zoom={mapZoom} accuracyM={draft?.accuracyM ?? (saved ? np.accuracyM : 0)} onPick={onMapPick} />

        {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
        {applying && <p className="rounded-lg bg-info-soft px-3 py-2 text-sm text-info">{applying}</p>}

        {draft && (
          <div className="space-y-2 rounded-xl border border-accent bg-accent-soft/40 p-3 text-sm">
            <div>
              New pin: <span className="num">{fmtCoord(draft.lat)}°, {fmtCoord(draft.lng)}°</span> ({LOCATION_SOURCE_LABELS[draft.source]}
              {draft.accuracyM ? `, ±${draft.accuracyM} m` : ""})
            </div>
            <PinCheck checking={draft.checking} error={draft.checkError} check={draft.check} match={draftMatch} postcode={np.postcode} />
            {draft.accuracyM > 30 && <p className="text-xs text-warn">GPS accuracy is ±{draft.accuracyM} m: check the pin is on the right roof and drag it if needed.</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => confirm(draft)} disabled={draft.checking || Boolean(applying)}>
                {draftMatch === "mismatch" || draftMatch === "no_building" ? "Use this location anyway" : "Confirm location & fetch climate data"}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setDraft(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {saved && !draft && (
          <div className="space-y-1.5 rounded-xl border border-line p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Building location:</span>
              <span className="num">
                {fmtCoord(site.latitude)}°, {fmtCoord(site.longitude)}°
              </span>
              <span className="text-muted">
                from {LOCATION_SOURCE_LABELS[np.source]}
                {np.accuracyM ? ` (±${np.accuracyM} m)` : ""}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <MatchBadge match={savedMatch} pinPostcode={np.pinPostcode} distance={np.pinDistanceM} />
              {np.verifiedAt && <span className="text-xs text-muted">checked {new Date(np.verifiedAt).toLocaleDateString("en-GB")}</span>}
              {!np.pinChecked && (
                <button type="button" className="btn btn-sm" onClick={recheckSaved}>
                  Check with NIPOST
                </button>
              )}
              <button type="button" className="btn btn-sm" onClick={() => setManual((v) => !v)}>
                {manual ? "Hide coordinates" : "Edit coordinates"}
              </button>
            </div>
          </div>
        )}
        {(manual || (!saved && !draft)) && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Latitude" hint={!saved ? "Optional: type coordinates you already have instead of pinning" : undefined}>
              <NumInput value={site.latitude} min={-90} max={90} onChange={(latitude) => setSite({ latitude, nipost: { ...np, source: "manual", accuracyM: 0, pinChecked: false, pinPostcode: "" } })} suffix="°" />
            </Field>
            <Field label="Longitude">
              <NumInput value={site.longitude} min={-180} max={180} onChange={(longitude) => setSite({ longitude, nipost: { ...np, source: "manual", accuracyM: 0, pinChecked: false, pinPostcode: "" } })} suffix="°" />
            </Field>
          </div>
        )}
      </div>

      {/* 3. Remote: ask the client */}
      <ClientLocationRequest
        projectId={project._id}
        clientName={client.name}
        clientPhone={client.phone}
        onShow={(r) => {
          if (r.postcode && !np.postcode) setSite({ nipost: { ...np, postcode: r.postcode, validity: "unchecked" } });
          placeDraft({ lat: r.lat, lng: r.lng }, "client", r.accuracyM);
        }}
      />
    </div>
  );
}

function PinCheck({ checking, error, check, match, postcode }: { checking: boolean; error: string; check: ReverseResult | null; match: ReturnType<typeof pinMatch>; postcode: string }) {
  if (checking) return <p className="text-muted">Asking NIPOST which building this is…</p>;
  if (error) return <p className="text-warn">NIPOST check failed: {error}. You can still use the location.</p>;
  if (!check?.configured) return <p className="text-muted">NIPOST checking is not set up on this server, so the building was not verified.</p>;
  if (!check.found) return <p className="text-warn">NIPOST has no building within 50 m of this pin. Move the pin onto the roof, or the building may not have a postcode yet.</p>;
  const where = [check.locality, check.lgaName].filter(Boolean).join(", ");
  return (
    <p className={match === "matched" ? "text-good" : match === "mismatch" && postcode ? "text-warn" : "text-text"}>
      {match === "matched" ? "✓ " : ""}NIPOST building here: <strong className="font-mono">{canonicalPostcode(check.postcode ?? "")}</strong> ({check.distanceM} m from the pin, {check.confidence} confidence{where ? `, ${where}` : ""}).{" "}
      {match === "matched" ? "Matches the postcode." : postcode ? `This is not ${postcode}: move the pin onto the client's building.` : "Its postcode will be saved with the location."}
    </p>
  );
}

function MatchBadge({ match, pinPostcode, distance }: { match: ReturnType<typeof pinMatch>; pinPostcode: string; distance: number }) {
  if (match === "matched") return <Badge tone="good">✓ NIPOST verified: pin is on {pinPostcode}</Badge>;
  if (match === "mismatch") return <Badge tone="warn">Pin is on {pinPostcode} ({distance} m), not the entered postcode</Badge>;
  if (match === "no_building") return <Badge tone="warn">No NIPOST building at the pin</Badge>;
  return <Badge tone="neutral">Not verified with NIPOST</Badge>;
}

/* ------------------------------------------------------------------ */
/* Request the location from the client (remote designs)               */
/* ------------------------------------------------------------------ */

interface ReqInfo {
  id: string;
  status: "pending" | "submitted" | "closed";
  expiresAt: string;
  result: null | { lat: number; lng: number; accuracyM: number; source: "gps" | "map"; postcode: string; note: string; pinChecked: boolean; pinPostcode: string; pinDistanceM: number; submittedAt: string };
}

function ClientLocationRequest({ projectId, clientName, clientPhone, onShow }: { projectId: string; clientName: string; clientPhone: string; onShow: (r: NonNullable<ReqInfo["result"]>) => void }) {
  const [req, setReq] = useState<ReqInfo | null>(null);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const url = `/api/projects/${projectId}/location-request`;

  const load = useCallback(async () => {
    const res = await fetch(url).catch(() => null);
    if (res?.ok) setReq(((await res.json()) as { request: ReqInfo | null }).request);
  }, [url]);

  // Poll while waiting for the client.
  useEffect(() => {
    load();
    const t = setInterval(() => req?.status === "pending" && load(), 15000);
    return () => clearInterval(t);
  }, [load, req?.status]);

  async function create() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create the link");
      setLink(data.link);
      setReq(data.request);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not create the link");
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    await fetch(url, { method: "DELETE" }).catch(() => null);
    setReq(null);
    setLink("");
  }

  const text = `Hello${clientName ? ` ${clientName}` : ""}, please open this link on your phone while at the building where the solar system will be installed, and share its location (and your NIPOST postcode if you have one): ${link}`;
  const phone = clientPhone.replace(/[^\d]/g, "").replace(/^0/, "234");
  const r = req?.result;

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-line p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Not on site? Ask the client</h3>
          <p className="text-xs text-muted">Send a link. The client opens it at the building and shares the GPS location (and their postcode). You review it here before it is used.</p>
        </div>
        <button type="button" className="btn btn-sm" onClick={create} disabled={busy}>
          {busy ? "Creating…" : req ? "New link" : "Request location from client"}
        </button>
      </div>
      {msg && <p className="text-bad">{msg}</p>}
      {link && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input className="input min-w-0 flex-1 font-mono text-xs" readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Location request link" />
            <button type="button" className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(link).then(() => setMsg(""))}>
              Copy
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="btn btn-sm" href={`https://wa.me/${phone.length >= 10 ? phone : ""}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
              Send by WhatsApp
            </a>
            <a className="btn btn-sm" href={`sms:${clientPhone}?body=${encodeURIComponent(text)}`}>
              Send by SMS
            </a>
          </div>
          <p className="text-xs text-muted">The link works for 7 days. Creating a new link cancels this one.</p>
        </div>
      )}
      {req?.status === "pending" && !link && <p className="text-muted">A link was sent and the client has not answered yet (it expires {new Date(req.expiresAt).toLocaleDateString("en-GB")}). Lost the link? Create a new one.</p>}
      {req?.status === "pending" && link && <p className="text-muted">Waiting for the client… this updates automatically.</p>}
      {r && (
        <div className="space-y-2 rounded-lg bg-good-soft/60 p-3">
          <p>
            <strong>The client shared a location</strong> on {new Date(r.submittedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}: <span className="num">{fmtCoord(r.lat)}°, {fmtCoord(r.lng)}°</span> ({r.source === "gps" ? `phone GPS, ±${r.accuracyM} m` : "pin on map"})
            {r.postcode && (
              <>
                {" "}
                · postcode <span className="font-mono">{r.postcode}</span>
              </>
            )}
            {r.pinChecked && <> · NIPOST building at that point: {r.pinPostcode ? <span className="font-mono">{r.pinPostcode}</span> : "none found"}</>}
          </p>
          {r.note && <p className="text-xs">Client&apos;s note: “{r.note}”</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onShow(r)}>
              Show on map to review
            </button>
            <button type="button" className="btn btn-sm" onClick={close}>
              Done, close request
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

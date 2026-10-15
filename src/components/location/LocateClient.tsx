"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { canonicalPostcode, inNigeria, parsePostcode } from "@/lib/postcode";
import type { LatLng } from "./LocationMap";
import { currentPosition, pickWithWidget, widgetEnabled } from "./nipost-client";

const LocationMap = dynamic(() => import("./LocationMap").then((m) => m.LocationMap), {
  ssr: false,
  loading: () => <div className="flex h-80 items-center justify-center rounded-xl border border-line bg-surface-2 text-sm text-muted">Loading map…</div>,
});

const NIGERIA: LatLng = { lat: 9.06, lng: 7.49 };

/** The client's side of a location request: share the building's GPS location (and NIPOST postcode). */
export function LocateClient({ token }: { token: string }) {
  const api = `/api/locate/${encodeURIComponent(token)}`;
  const [info, setInfo] = useState<{ engineerName: string; company: string; status: string } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [pin, setPin] = useState<(LatLng & { accuracyM: number; source: "gps" | "map" }) | null>(null);
  const [postcode, setPostcode] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(api)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "This link is not valid");
        setInfo(d);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "This link is not valid"));
  }, [api]);

  async function gps() {
    setBusy("gps");
    setError("");
    try {
      const fix = await currentPosition();
      if (!inNigeria(fix.lat, fix.lng)) throw new Error("Your phone reports a location outside Nigeria. Place the pin on the map instead.");
      setPin({ ...fix, source: "gps" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not get your location");
    } finally {
      setBusy("");
    }
  }

  async function widget() {
    setBusy("widget");
    setError("");
    try {
      const sel = await pickWithWidget();
      if (sel && !sel.temporary) setPostcode(canonicalPostcode(sel.formatted || sel.postcode));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The NIPOST widget failed");
    } finally {
      setBusy("");
    }
  }

  const onPick = useCallback((p: LatLng) => setPin((prev) => ({ ...p, accuracyM: 0, source: prev?.source === "gps" ? "gps" : "map" })), []);

  async function submit() {
    if (!pin) return;
    if (postcode.trim() && !parsePostcode(postcode)) return setError("That postcode is not in the NIPOST format (e.g. FC-02-A09-DB-09). Check it or leave it empty.");
    setBusy("submit");
    setError("");
    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: pin.lat, lng: pin.lng, accuracyM: pin.accuracyM, source: pin.source, postcode, note }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not send the location");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the location");
    } finally {
      setBusy("");
    }
  }

  if (loadError)
    return (
      <div className="card p-6">
        <h1 className="text-xl font-bold">Link not available</h1>
        <p className="mt-2 text-muted">{loadError}</p>
      </div>
    );
  if (!info) return <p className="text-muted">Loading…</p>;
  if (done)
    return (
      <div className="card space-y-2 p-6">
        <h1 className="text-xl font-bold">Thank you, location sent ✓</h1>
        <p className="text-muted">{info.engineerName || "Your installer"} can now see your building on the map and design your solar system for it. You can close this page.</p>
        <button className="btn btn-sm" onClick={() => setDone(false)}>
          Send a corrected location
        </button>
      </div>
    );

  const asker = [info.engineerName, info.company].filter(Boolean).join(", ") || "Your solar installer";
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Share your building&apos;s location</h1>
        <p className="mt-1 text-muted">
          <strong className="text-text">{asker}</strong> is designing a solar system for your building and needs its exact location. It is only shared with them.
        </p>
      </div>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">1. Your location</h2>
        <p className="text-sm text-muted">Best: stand at the building (outside or near a window) and tap the button. Otherwise, tap your roof on the map.</p>
        <button className="btn btn-primary w-full py-3" onClick={gps} disabled={busy === "gps"}>
          {busy === "gps" ? "Getting your location…" : "📍 Use my current location"}
        </button>
        <LocationMap pin={pin} centre={pin ?? NIGERIA} zoom={pin ? 19 : 6} accuracyM={pin?.accuracyM ?? 0} onPick={onPick} />
        {pin ? (
          <p className="text-sm">
            Pin placed{pin.accuracyM ? ` (accuracy about ±${pin.accuracyM} m)` : ""}. If it is not on your roof, drag it there.
          </p>
        ) : (
          <p className="text-sm text-muted">No location yet.</p>
        )}
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">2. NIPOST postcode (optional)</h2>
        <p className="text-sm text-muted">If you have your building&apos;s digital postcode (from the NIPOST Postcode app or postcode.gov.ng), add it.</p>
        <div className="flex flex-wrap gap-2">
          <input className="input min-w-0 flex-1 font-mono uppercase" value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="FC-02-A09-DB-09" aria-label="NIPOST postcode" />
          {widgetEnabled && (
            <button className="btn" onClick={widget} disabled={busy === "widget"}>
              {busy === "widget" ? "Opening…" : "Find in NIPOST"}
            </button>
          )}
        </div>
        <label className="block">
          <span className="label">Note for the installer (optional)</span>
          <input className="input" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="e.g. the blue gate, second building on the left" />
        </label>
      </section>

      {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      <button className="btn btn-primary w-full py-3" onClick={submit} disabled={!pin || busy === "submit"}>
        {busy === "submit" ? "Sending…" : "Send location"}
      </button>
      <p className="text-xs text-muted">Postcodes: Nigerian Postal Service (NIPOST). Map imagery: Esri; map data: © OpenStreetMap contributors.</p>
    </div>
  );
}

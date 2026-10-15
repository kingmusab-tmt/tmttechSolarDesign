"use client";

import "leaflet/dist/leaflet.css";
import type { Circle, Map as LeafletMap, Marker } from "leaflet";
import { useEffect, useRef, useState } from "react";
import { cx } from "../ui";

export interface LatLng {
  lat: number;
  lng: number;
}

type L = typeof import("leaflet");

/**
 * Satellite map for pinning the building: tap/click to place the pin, drag to fine-tune.
 * Imagery: Esri World Imagery; streets: OpenStreetMap (both credited on the map and on /credits).
 */
export function LocationMap({ pin, centre, zoom = 18, accuracyM = 0, onPick, className }: { pin: LatLng | null; centre: LatLng; zoom?: number; accuracyM?: number; onPick: (p: LatLng) => void; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const lib = useRef<L | null>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const circle = useRef<Circle | null>(null);
  const pickRef = useRef(onPick);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    pickRef.current = onPick;
  }, [onPick]);

  // Leaflet touches `window`, so load it only in the browser.
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((mod) => {
      const Lf = (mod as unknown as { default?: L }).default ?? (mod as L);
      if (cancelled || !el.current || map.current) return;
      lib.current = Lf;
      const m = Lf.map(el.current, { center: [centre.lat, centre.lng], zoom, zoomControl: true });
      const satellite = Lf.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 20,
        maxNativeZoom: 19,
        attribution: "Imagery © Esri, Maxar, Earthstar Geographics and the GIS User Community",
      });
      const labels = Lf.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20, maxNativeZoom: 19 });
      const streets = Lf.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 20, maxNativeZoom: 19, attribution: "© OpenStreetMap contributors" });
      const sat = Lf.layerGroup([satellite, labels]).addTo(m);
      Lf.control.layers({ Satellite: sat, Streets: streets }, undefined, { position: "topright" }).addTo(m);
      m.on("click", (e) => pickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
      map.current = m;
      setReady(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
      circle.current = null;
    };
    // The map is created once; later centre/pin changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recentre when the area changes and nothing is pinned yet.
  useEffect(() => {
    if (ready && !pin) map.current?.setView([centre.lat, centre.lng], zoom);
  }, [ready, centre.lat, centre.lng, zoom, pin]);

  // Keep the pin (and the GPS accuracy circle) in sync with the value.
  useEffect(() => {
    const Lf = lib.current;
    const m = map.current;
    if (!ready || !Lf || !m) return;
    if (!pin) {
      marker.current?.remove();
      circle.current?.remove();
      marker.current = circle.current = null;
      return;
    }
    const at: [number, number] = [pin.lat, pin.lng];
    if (!marker.current) {
      const icon = Lf.divIcon({ className: "", html: '<div class="map-pin"></div>', iconSize: [26, 26], iconAnchor: [13, 30] });
      marker.current = Lf.marker(at, { draggable: true, icon, title: "Building location: drag to adjust", autoPan: true }).addTo(m);
      marker.current.on("dragend", () => {
        const p = marker.current!.getLatLng();
        pickRef.current({ lat: p.lat, lng: p.lng });
      });
      m.setView(at, Math.max(m.getZoom(), 18)); // roof level
    } else {
      marker.current.setLatLng(at);
      if (!m.getBounds().contains(at)) m.panTo(at);
    }
    circle.current?.remove();
    circle.current = accuracyM > 0 ? Lf.circle(at, { radius: accuracyM, color: "#2563eb", weight: 1, fillOpacity: 0.08, interactive: false }).addTo(m) : null;
  }, [ready, pin, accuracyM, zoom]);

  return <div ref={el} className={cx("isolate h-80 w-full overflow-hidden rounded-xl border border-line", className)} role="application" aria-label="Map: tap the building to place the pin" />;
}

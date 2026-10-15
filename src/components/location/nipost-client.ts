"use client";

/** Browser-side helpers for locating a site: device GPS, our NIPOST API routes and the NIPOST widget. */

export interface GpsFix {
  lat: number;
  lng: number;
  accuracyM: number;
}

/** One high-accuracy GPS fix. Rejects with a readable message. */
export function currentPosition(): Promise<GpsFix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return reject(new Error("This device or browser cannot share its location"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: Math.round(p.coords.accuracy) }),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? "Location permission was refused. Allow location for this site in the browser settings, or place the pin on the map."
              : e.code === e.TIMEOUT
                ? "Getting a GPS fix took too long. Move near a window or outdoors and try again."
                : "The device could not determine its location. Place the pin on the map instead.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Request failed");
  return data as T;
}

export interface ValidateResult {
  postcode: string;
  configured: boolean;
  valid: boolean | null;
  stateName: string;
  lgaName: string;
}
export const validatePostcode = (code: string) => getJson<ValidateResult>(`/api/postcode?action=validate&code=${encodeURIComponent(code)}`);

export interface ReverseResult {
  configured: boolean;
  found?: boolean;
  postcode?: string;
  distanceM?: number;
  confidence?: string;
  stateName?: string;
  lgaName?: string;
  locality?: string;
  address?: string;
}
export const reverseLookup = (lat: number, lng: number) => getJson<ReverseResult>(`/api/postcode?action=reverse&lat=${lat}&lng=${lng}`);

export const placeCentre = (q: string) => getJson<{ centre: { lat: number; lon: number } | null }>(`/api/postcode?action=centre&q=${encodeURIComponent(q)}`).then((d) => d.centre);

/* ------------------------------------------------------------------ */
/* NIPOST Postcode Widget (https://docs.postcode.gov.ng/widget)        */
/* ------------------------------------------------------------------ */

/** Selection payload (version 1) delivered by every widget SDK. It carries no coordinates. */
export interface WidgetSelection {
  version: number;
  postcode: string;
  formatted: string;
  segments?: Record<string, string | null>;
  names?: { state?: string | null; lga?: string | null; district?: string | null; area?: string | null };
  address?: string | null;
  temporary?: true;
}

interface WidgetApi {
  open(opts: { key: string; identifierType?: "email" | "nin"; identifier?: string; environment?: "production" | "staging"; onError?: (e: { code: string; message: string }) => void }): Promise<WidgetSelection | null>;
}

const WIDGET_KEY = process.env.NEXT_PUBLIC_NIPOST_PUBLISHABLE_KEY ?? "";
const WIDGET_ENV = process.env.NEXT_PUBLIC_NIPOST_ENV === "staging" ? "staging" : "production";
const WIDGET_SRC = process.env.NEXT_PUBLIC_NIPOST_WIDGET_SRC || "https://unpkg.com/@nipost/postcode-widget@0.1.0/dist/sdk.js";

/** The widget button is shown only when a publishable key is configured. */
export const widgetEnabled = Boolean(WIDGET_KEY);

let loading: Promise<WidgetApi> | null = null;
function loadWidget(): Promise<WidgetApi> {
  const w = window as unknown as { PostcodeWidget?: WidgetApi };
  if (w.PostcodeWidget) return Promise.resolve(w.PostcodeWidget);
  loading ??= new Promise<WidgetApi>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = WIDGET_SRC;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.onload = () => (w.PostcodeWidget ? resolve(w.PostcodeWidget) : reject(new Error("The NIPOST widget did not load")));
    s.onerror = () => reject(new Error("Could not load the NIPOST widget. Check your connection."));
    document.head.appendChild(s);
  }).catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

/** Let the user pick their building's postcode in NIPOST's own widget (saved postcodes or map). */
export async function pickWithWidget(email?: string): Promise<WidgetSelection | null> {
  if (!WIDGET_KEY) throw new Error("The NIPOST widget is not set up on this server");
  const api = await loadWidget();
  let failure = "";
  const sel = await api.open({
    key: WIDGET_KEY,
    environment: WIDGET_ENV,
    identifierType: "email",
    ...(email ? { identifier: email } : {}),
    onError: (e) => {
      failure = e.message || e.code;
    },
  });
  if (!sel && failure) throw new Error(`NIPOST widget: ${failure}`);
  return sel;
}

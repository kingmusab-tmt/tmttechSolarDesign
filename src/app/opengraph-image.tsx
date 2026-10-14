import { ImageResponse } from "next/og";
import { APP_NAME, COMPANY } from "@/lib/brand";

// Same artwork as public/icon.svg and the in-app logo.
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#15803d"/><circle cx="32" cy="22" r="8" fill="#fff"/><g stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M32 6v4M18 12l3 3M46 12l-3 3M12 24h4M48 24h4"/></g><path d="M12 52l6-16h28l6 16z" fill="#fff"/><path d="M22 36l-2 16M32 36v16M42 36l2 16M15 44h34" stroke="#15803d" stroke-width="2"/></svg>`;
const LOGO = `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString("base64")}`;

export const alt = `${APP_NAME}: solar home system design software`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Link-preview image for social media and messaging apps. */
export default function OpengraphImage() {
  const tags = ["Load audit", "Inverter & battery sizing", "String design", "Single-line diagram", "Bill of Quantities", "Financials"];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg, #0f3d24 0%, #15803d 100%)", color: "#fff", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered by ImageResponse, not the browser */}
          <img src={LOGO} width={104} height={104} alt="" style={{ borderRadius: 24, border: "4px solid rgba(255,255,255,0.9)" }} />
          <div style={{ fontSize: 56, fontWeight: 700 }}>{APP_NAME}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.1, maxWidth: 980 }}>Design solar home systems the way engineers do.</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {tags.map((t) => (
              <div key={t} style={{ fontSize: 26, padding: "8px 18px", borderRadius: 999, background: "rgba(255,255,255,0.16)" }}>
                {t}
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 26, opacity: 0.85 }}>{`An idea by ${COMPANY.name}`}</div>
      </div>
    ),
    size,
  );
}

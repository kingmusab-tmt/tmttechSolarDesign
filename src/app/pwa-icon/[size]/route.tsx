import { ImageResponse } from "next/og";

const SIZES = [180, 192, 512];

export function generateStaticParams() {
  return SIZES.map((s) => ({ size: String(s) }));
}

/** PNG app icons rendered at build time (required for PWA installability). */
export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const n = Number((await ctx.params).size);
  const size = SIZES.includes(n) ? n : 192;
  const u = size / 64;
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, background: "#d97706", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <div style={{ position: "absolute", top: 14 * u, left: 24 * u, width: 16 * u, height: 16 * u, borderRadius: 999, background: "#fff" }} />
        <div style={{ position: "absolute", top: 36 * u, left: 14 * u, width: 36 * u, height: 16 * u, background: "#fff", borderRadius: 2 * u, display: "flex" }}>
          <div style={{ width: "100%", height: 2 * u, marginTop: 7 * u, background: "#d97706" }} />
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}

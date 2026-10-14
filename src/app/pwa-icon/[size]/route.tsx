import { ImageResponse } from "next/og";

/** "any" icons at standard sizes, plus maskable variants with the artwork inside the safe zone. */
const VARIANTS: Record<string, { size: number; maskable: boolean }> = {
  "180": { size: 180, maskable: false },
  "192": { size: 192, maskable: false },
  "512": { size: 512, maskable: false },
  "maskable-192": { size: 192, maskable: true },
  "maskable-512": { size: 512, maskable: true },
};

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((size) => ({ size }));
}

/** PNG app icons rendered at build time (required for PWA installability). */
export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const v = VARIANTS[(await ctx.params).size] ?? VARIANTS["192"];
  const size = v.size;
  // Maskable: launchers may crop to a circle keeping only the central 80 %, so shrink the artwork
  // to 70 % and centre it; the background stays full-bleed.
  const scale = v.maskable ? 0.7 : 1;
  const u = (size / 64) * scale;
  const offset = (size - 64 * u) / 2;
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, background: "#15803d", display: "flex", position: "relative", borderRadius: v.maskable ? 0 : size * 0.18 }}>
        <div style={{ position: "absolute", top: offset + 14 * u, left: offset + 24 * u, width: 16 * u, height: 16 * u, borderRadius: 999, background: "#fff" }} />
        <div style={{ position: "absolute", top: offset + 36 * u, left: offset + 14 * u, width: 36 * u, height: 16 * u, background: "#fff", borderRadius: 2 * u, display: "flex" }}>
          <div style={{ width: "100%", height: 2 * u, marginTop: 7 * u, background: "#15803d" }} />
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}

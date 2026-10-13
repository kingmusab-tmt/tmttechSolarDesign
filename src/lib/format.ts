export function fmt(n: number, dp = 0): string {
  if (!Number.isFinite(n)) return "–";
  return n.toLocaleString("en-NG", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function money(n: number, currency = "NGN"): string {
  if (!Number.isFinite(n)) return "–";
  const sym = currency === "NGN" ? "₦" : currency === "USD" ? "$" : `${currency} `;
  return `${n < 0 ? "−" : ""}${sym}${Math.abs(Math.round(n)).toLocaleString("en-NG")}`;
}

/** Compact money: ₦1.2M, ₦450K */
export function moneyCompact(n: number, currency = "NGN"): string {
  const sym = currency === "NGN" ? "₦" : currency === "USD" ? "$" : `${currency} `;
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (a >= 1e9) return `${sign}${sym}${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${sign}${sym}${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}${sym}${(a / 1e3).toFixed(0)}K`;
  return `${sign}${sym}${Math.round(a)}`;
}

export function power(w: number): string {
  return w >= 1000 ? `${fmt(w / 1000, 2)} kW` : `${fmt(w, 0)} W`;
}

export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

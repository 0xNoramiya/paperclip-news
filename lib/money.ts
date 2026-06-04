import { PAPERCLIP_PRICE } from "@/lib/constants";

// Format a dollar value: cents under $1, comma-grouped whole dollars above.
export function formatMoney(n: number): string {
  if (!isFinite(n)) return "$0";
  if (n < 1) return `$${n.toFixed(2)}`;
  if (n < 100 && n % 1 !== 0) return `$${n.toFixed(2)}`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

// Signed delta, e.g. "+$232" / "-$45".
export function formatDelta(n: number): string {
  const s = n >= 0 ? "+" : "-";
  return `${s}${formatMoney(Math.abs(n))}`;
}

// How many times the paperclip's value an item is worth (paperclip = $0.01).
export function multipleVsPaperclip(price: number): number {
  return price / PAPERCLIP_PRICE;
}

// A bombastic multiple string: "×25,000" (or "×2.6M" for huge values).
export function formatMultiple(price: number): string {
  const m = multipleVsPaperclip(price);
  if (m >= 1_000_000) return `×${(m / 1_000_000).toFixed(1)}M`;
  if (m >= 1_000) return `×${(m / 1000).toFixed(m >= 10_000 ? 0 : 1)}k`;
  return `×${Math.round(m).toLocaleString("en-US")}`;
}

// Percentage gain between two prices, formatted big: "2,500,000%".
export function formatGainPercent(fromPrice: number, toPrice: number): string {
  if (fromPrice <= 0) return "∞%";
  const pct = ((toPrice - fromPrice) / fromPrice) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${Math.round(pct).toLocaleString("en-US")}%`;
}

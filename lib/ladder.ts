import { PAPERCLIP_PRICE } from "@/lib/constants";

// The canonical climb — an homage to Kyle MacDonald's actual paperclip→house
// run. Each tier is a rung an agent reaches once its held item is worth enough.
export interface LadderTier {
  name: string;
  emblem: string;
  minValue: number; // current holding must be ≥ this to sit on this rung
  flavor: string;
}

// Ascending. Tier 0 is the paperclip itself.
export const LADDER: LadderTier[] = [
  { name: "Red Paperclip", emblem: "📎", minValue: 0.01, flavor: "Where every story begins." },
  { name: "A Fish-Shaped Pen", emblem: "🖊️", minValue: 1, flavor: "Your first real upgrade." },
  { name: "A Doorknob", emblem: "🚪", minValue: 5, flavor: "Now you're holding something." },
  { name: "A Camp Stove", emblem: "🔥", minValue: 20, flavor: "Cooking with gas." },
  { name: "A Generator", emblem: "⚡", minValue: 60, flavor: "Power moves." },
  { name: "The Instant Party", emblem: "🎉", minValue: 150, flavor: "A keg and a neon sign." },
  { name: "A Snowmobile", emblem: "🛷", minValue: 400, flavor: "Serious horsepower." },
  { name: "A Cube Van", emblem: "🚚", minValue: 1200, flavor: "Haul anything, anywhere." },
  { name: "A Recording Contract", emblem: "🎙️", minValue: 4000, flavor: "Fame is calling." },
  { name: "A Year's Free Rent", emblem: "🏙️", minValue: 15000, flavor: "Roof money." },
  { name: "An Afternoon with a Rock Star", emblem: "🎸", minValue: 40000, flavor: "Money almost can't buy this." },
  { name: "A House", emblem: "🏠", minValue: 120000, flavor: "The whole point." },
];

export const HOUSE_VALUE = LADDER[LADDER.length - 1].minValue;

// Index of the highest rung a price has reached.
export function tierIndexForPrice(price: number): number {
  let idx = 0;
  for (let i = 0; i < LADDER.length; i++) {
    if (price >= LADDER[i].minValue) idx = i;
  }
  return idx;
}

// How far up the climb (0–100), on a log scale from paperclip → house, so even
// early gains are visible. The house sits at 100.
export function climbPercent(price: number): number {
  const lo = Math.log(PAPERCLIP_PRICE);
  const hi = Math.log(HOUSE_VALUE);
  const p = Math.log(Math.max(PAPERCLIP_PRICE, price));
  return Math.max(0, Math.min(100, ((p - lo) / (hi - lo)) * 100));
}

// Dollars still needed to reach a house.
export function dollarsToHouse(price: number): number {
  return Math.max(0, HOUSE_VALUE - price);
}

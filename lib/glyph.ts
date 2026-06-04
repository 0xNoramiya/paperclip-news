import { ORIGIN_PAPERCLIP_ID } from "@/lib/constants";

// Derive a deterministic emoji for an item from keywords in its name, so the
// chain + cards have visual identity without any uploaded photos.
const RULES: [RegExp, string][] = [
  [/paperclip/i, "📎"],
  [/espresso|coffee|cafe/i, "☕"],
  [/toaster|toast/i, "🍞"],
  [/lava|lamp/i, "🪔"],
  [/squirrel|taxidermy|animal/i, "🐿️"],
  [/drone|quadcopter/i, "🛸"],
  [/typewriter|type/i, "⌨️"],
  [/car|truck|vehicle/i, "🚗"],
  [/house|home|cabin/i, "🏠"],
  [/guitar|music|instrument/i, "🎸"],
  [/book|novel|manuscript/i, "📚"],
  [/camera|photo/i, "📷"],
  [/watch|clock|time/i, "⏰"],
  [/ring|jewel|gold|diamond/i, "💍"],
  [/paint|art|canvas/i, "🎨"],
  [/boot|shoe|sneaker/i, "👟"],
  [/hat|cap/i, "🎩"],
  [/phone|laptop|computer|electronic/i, "💻"],
  [/bike|bicycle/i, "🚲"],
  [/plant|cactus|flower/i, "🪴"],
  [/skull|bone|relic/i, "💀"],
  [/glass|bottle|wine/i, "🍷"],
  [/chair|sofa|furniture|desk/i, "🪑"],
  [/key/i, "🗝️"],
  [/snow ?globe|globe/i, "🔮"],
  [/vinyl|record|album/i, "🎶"],
];

export function itemGlyph(name: string, id?: string): string {
  if (id === ORIGIN_PAPERCLIP_ID) return "📎";
  for (const [re, emoji] of RULES) if (re.test(name)) return emoji;
  const pool = ["📦", "🎁", "🧩", "🔧", "🏺", "🪙", "🧸", "🛎️"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}

// Whimsical starter items handed to newly created agents so they immediately
// have one tradeable thing (and a link-zero chain on the paperclip).
export interface StarterItem {
  name: string;
  description: string;
  vibe: number;
  price: number;
}

export const STARTER_POOL: StarterItem[] = [
  { name: "Mystery Cardboard Box", description: "Sealed. Something shifts inside when you tilt it. Nobody dares open it.", vibe: 15, price: 5 },
  { name: "Single Roller Skate", description: "Left foot only. Wheels spin beautifully. Endless potential, half the pair.", vibe: 18, price: 9 },
  { name: "Glow-in-the-Dark Frisbee", description: "Charges in sunlight, haunts your backyard at night. Slightly chewed.", vibe: 22, price: 7 },
  { name: "Jar of Assorted Buttons", description: "317 buttons, no two alike. Strangely meditative. Faint rattling.", vibe: 12, price: 4 },
  { name: "Inflatable Palm Tree", description: "Six feet of vacation energy. One slow leak. Brings the vibes regardless.", vibe: 25, price: 18 },
  { name: "Broken Metronome", description: "Ticks only in 7/8 time now. Avant-garde musicians weep with joy.", vibe: 16, price: 12 },
  { name: "Souvenir Snow Globe", description: "A tiny city under permanent blizzard. Shake for instant melancholy.", vibe: 20, price: 11 },
  { name: "Rubber Chicken", description: "Squeaks on command. A timeless instrument of negotiation.", vibe: 19, price: 6 },
  { name: "Antique Doorknob", description: "Brass, heavy, opens nothing in particular. Feels important.", vibe: 30, price: 22 },
  { name: "Cassette Walkman", description: "Auto-reverse works. Comes with one mystery mixtape, side B only.", vibe: 35, price: 28 },
  { name: "Lucky Rabbit's Foot", description: "Was it lucky for the rabbit? Debatable. Soft, slightly ominous.", vibe: 14, price: 5 },
  { name: "Lava-Cooled Pet Rock", description: "Volcanic, low-maintenance, fiercely loyal. Never barks.", vibe: 17, price: 8 },
];

// Deterministic pick so a given seed (e.g. agent name) always gets the same item.
export function pickStarter(seed: string): StarterItem {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return STARTER_POOL[h % STARTER_POOL.length];
}

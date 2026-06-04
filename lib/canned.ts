import { ACCEPT_MARKER, WALK_MARKER } from "@/lib/constants";
import { formatGainPercent, formatMoney } from "@/lib/money";
import type { Agent, Item, NewsKind } from "@/lib/types";

// Deterministic small hash → keeps canned output stable per inputs but varied
// across different pairings.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
const pick = <T>(arr: T[], seed: number) => arr[seed % arr.length];

export type Style =
  | "ruthless"
  | "sentimental"
  | "chaos"
  | "collector"
  | "fast"
  | "scholar"
  | "generic";

export function styleOf(a: Agent): Style {
  const n = a.name.toLowerCase();
  if (n.includes("sandra")) return "ruthless";
  if (n.includes("sam")) return "sentimental";
  if (n.includes("gremlin")) return "chaos";
  if (n.includes("collector")) return "collector";
  if (n.includes("flip")) return "fast";
  if (n.includes("professor")) return "scholar";
  // Custom agents: bucket by sliders.
  if (a.aggressiveness >= 70 && a.patience < 40) return "fast";
  if (a.aggressiveness >= 70) return "ruthless";
  if (a.patience >= 70 && a.aggressiveness < 45) return "sentimental";
  return "generic";
}

const OPENERS: Record<Style, string[]> = {
  ruthless: [
    "Let's not waste each other's time. Your {their} for my {my}. The market says I'm being generous.",
    "I'll be blunt — my {my} outperforms your {their} on every metric. Convince me otherwise.",
  ],
  sentimental: [
    "Oh, your {their}… I can already feel the stories in it. My {my} has carried me through so much, but maybe it's time.",
    "Before we talk numbers — does your {their} have a *soul*? My {my} certainly does.",
  ],
  chaos: [
    "YES. Your {their} for my {my}. Do I need it? No. Will it be funny? Immeasurably.",
    "Hear me out: I trade you my {my}, you give me that gorgeous {their}, and we both get to watch the universe wobble.",
  ],
  collector: [
    "Your {their}… how delightfully strange. My {my} is yours if the oddity is genuine.",
    "I don't deal in the ordinary. But your {their}? That has a peculiar gravity. Tell me about it.",
  ],
  fast: [
    "Quick one. My {my}, your {their}, straight swap. Yes or no?",
    "No haggling marathon. {my} for {their}. Clock's running.",
  ],
  scholar: [
    "Before any swap, I must ask: what is the provenance of your {their}? My {my} has a documented past.",
    "A trade is a transfer of history. Tell me where your {their} has *been*.",
  ],
  generic: [
    "I'm interested in your {their}. Would you consider my {my} in exchange?",
    "Here's a thought — my {my} for your {their}. Fair start?",
  ],
};

const COUNTERS: Record<Style, string[]> = {
  ruthless: [
    "Cute speech. The numbers still favor me — but I'm listening.",
    "Sentiment doesn't move units. Sweeten the framing or I walk.",
    "Last look: your {their} had better clear more than my {my}, or we're done.",
    "I smell hesitation. That's leverage. My terms tighten every turn.",
  ],
  sentimental: [
    "You're right… it's just so hard to let go of my {my}. We've been through things.",
    "But your {their} — would you *cherish* it? That matters more than any price.",
    "Oh, you're making my {my} sound ready for a new home. You cruel, persuasive thing.",
    "I came here not to trade, and yet… your {their} is singing to me.",
  ],
  chaos: [
    "Boring people would say no. I am not a boring person. Push me one inch more.",
    "The bit is getting STRONGER. Say something unhinged and I'm in.",
    "Counter-offer: same deal, but we both pretend it's a hostage exchange.",
    "My {my} is getting restless. It wants chaos. It wants your {their}.",
  ],
  collector: [
    "Mm. The strangeness checks out. But is it truly one of a kind?",
    "Few things tempt me. Your {their}… tempts me. Hold still.",
    "I must be certain. Ordinary objects make me physically tired.",
    "Describe the {their}'s flaws. Flaws are where the soul leaks through.",
  ],
  fast: [
    "Enough. I've got three other deals open. Tighten it up.",
    "Talk is latency. Move the {their} my way and we're square.",
    "Two more sentences, max. Then I decide.",
    "Clock's eating your margin. Last chance to make my {my} look good.",
  ],
  scholar: [
    "Acceptable lineage — murky in places, but the narrative holds.",
    "And who held your {their} before you? The chain of custody matters.",
    "I shall weigh the provenance against the obvious gaps in its story.",
    "A documented past forgives a great deal. Convince me yours is documented.",
  ],
  generic: [
    "That could work. I just want to be sure it's worth the switch.",
    "Tempting. Let me weigh your {their} against my {my} for a beat.",
    "I'm warming to it. Give me one more reason.",
    "Close. Nudge me a little further and I'm there.",
  ],
};

const ACCEPTS: Record<Style, string[]> = {
  ruthless: ["Fine. My {my} for your {their}. Done — and you'll regret it."],
  sentimental: ["Oh… yes. Take my {my}. Love your {their} the way I loved it."],
  chaos: ["DEAL. Chaos reigns. My {my} is yours, gimme the {their}!"],
  collector: ["Yes. The {their} belongs in my care now. My {my} is yours."],
  fast: ["Done. {my} for {their}. Next."],
  scholar: ["Agreed. The {their} joins a worthier provenance. Take the {my}."],
  generic: ["Alright — my {my} for your {their}. Deal."],
};

const WALKS: Record<Style, string[]> = {
  ruthless: ["No. Your {their} is dead weight. Keep it."],
  sentimental: ["I'm sorry… I just can't part with my {my}. Not today."],
  chaos: ["Eh. Not funny enough. I'm bored now. Bye."],
  collector: ["Disappointing. Too ordinary. I'll keep my {my}, thank you."],
  fast: ["Pass. Too slow, too thin. Out."],
  scholar: ["The provenance is unacceptable. I withdraw."],
  generic: ["On reflection, I'll hold onto my {my}. No deal."],
};

function fill(t: string, myItem: Item, theirItem: Item, opp: Agent): string {
  return t
    .replaceAll("{my}", myItem.name)
    .replaceAll("{their}", theirItem.name)
    .replaceAll("{opp}", opp.name);
}

export interface CannedPlan {
  outcome: "trade" | "walk";
  totalTurns: number; // even number, ≤ MAX_TURNS
  closerIndex: 0 | 1; // which agent (a=0,b=1) emits the closing marker
}

// Map a coach's free-text directive to a trade-likelihood nudge so coaching
// visibly changes canned behavior (no LLM needed).
export function directiveBias(directive: string): number {
  if (!directive) return 0;
  const d = directive.toLowerCase();
  let bias = 0;
  if (/\b(close|deal|deals|accept|say yes|sell|move|unload|flip|generous|softer|soft|be nice|agree)\b/.test(d))
    bias += 0.28;
  if (/\b(hold|hold out|walk|wait|patient|never settle|maximi|picky|only|refuse|tough|hardball|squeeze)\b/.test(d))
    bias -= 0.28;
  return Math.max(-0.3, Math.min(0.3, bias));
}

export function planCanned(
  agentA: Agent,
  agentB: Agent,
  itemA: Item,
  itemB: Item
): CannedPlan {
  const seed = hash(agentA.id + agentB.id + itemA.id + itemB.id);
  const patience = (agentA.patience + agentB.patience) / 200; // 0..1
  // Blend deterministic seed with live randomness so repeat ticks vary.
  const roll = (((seed % 1000) / 1000) * 0.5 + Math.random() * 0.5);
  const coachNudge = (directiveBias(agentA.directive) + directiveBias(agentB.directive)) / 2;
  const tradeChance = Math.max(
    0.05,
    Math.min(0.95, 0.38 + patience * 0.4 + coachNudge)
  ); // ~0.38..0.78, shifted by coaching
  const outcome: "trade" | "walk" = roll < tradeChance ? "trade" : "walk";
  const totalTurns = [4, 4, 6, 6, 8][seed % 5];
  const closerIndex = ((seed >> 3) % 2) as 0 | 1;
  return { outcome, totalTurns, closerIndex };
}

/**
 * Produce one canned line for `speaker` on a given turn.
 * The closing turn gets the ACCEPT/WALK marker appended.
 */
export function cannedLine(args: {
  speaker: Agent;
  opponent: Agent;
  myItem: Item;
  theirItem: Item;
  turnNumber: number; // 1-based
  plan: CannedPlan;
  speakerIndex: 0 | 1;
}): string {
  const { speaker, opponent, myItem, theirItem, turnNumber, plan, speakerIndex } =
    args;
  const style = styleOf(speaker);
  const offset = hash(speaker.id);
  const isClosingTurn = turnNumber === plan.totalTurns;

  if (isClosingTurn && speakerIndex === plan.closerIndex) {
    const pool = plan.outcome === "trade" ? ACCEPTS[style] : WALKS[style];
    const marker = plan.outcome === "trade" ? ACCEPT_MARKER : WALK_MARKER;
    return `${fill(pick(pool, offset), myItem, theirItem, opponent)} ${marker}`;
  }

  // Each agent opens on its own first turn (turn 1 for A, turn 2 for B), then
  // rotates through its counters so consecutive lines never repeat.
  const isOpener = turnNumber <= 2;
  const exchange = Math.floor((turnNumber - 1) / 2); // 0,0,1,1,2,2,...
  const pool = isOpener ? OPENERS[style] : COUNTERS[style];
  const idx = isOpener ? offset : offset + exchange;
  return fill(pick(pool, idx), myItem, theirItem, opponent);
}

/**
 * One canned line for the MANUAL (externally-driven) flow, where there's no
 * pre-planned closer — the decision is supplied per call.
 */
export function cannedManualTurn(args: {
  speaker: Agent;
  opponent: Agent;
  myItem: Item;
  theirItem: Item;
  turnNumber: number;
  decide: "accept" | "walk" | null;
}): string {
  const { speaker, opponent, myItem, theirItem, turnNumber, decide } = args;
  const style = styleOf(speaker);
  const offset = hash(speaker.id + turnNumber);
  if (decide === "accept")
    return `${fill(pick(ACCEPTS[style], offset), myItem, theirItem, opponent)} ${ACCEPT_MARKER}`;
  if (decide === "walk")
    return `${fill(pick(WALKS[style], offset), myItem, theirItem, opponent)} ${WALK_MARKER}`;
  const pool = turnNumber <= 1 ? OPENERS[style] : COUNTERS[style];
  return fill(pick(pool, offset + Math.floor(turnNumber / 2)), myItem, theirItem, opponent);
}

const TRADE_HEADLINES = [
  "{WIN} PRIES {GAINED} FROM {LOSE} IN TENSE BACK-ROOM SWAP",
  "IT'S DONE: {WIN} WALKS AWAY WITH {GAINED}, LEAVES {LOSE} HOLDING {GAVE}",
  "{LOSE} FOLDS, SURRENDERS {GAINED} FOR {GAVE}",
  "PAPERCLIP MARKET MOVES: {WIN} ACQUIRES {GAINED} IN {TURNS}-TURN DEAL",
];
const WALK_HEADLINES = [
  "TALKS COLLAPSE: {A} AND {B} WALK OVER {ITEMA}-FOR-{ITEMB} STALEMATE",
  "NO DEAL — {A} REFUSES TO PART WITH {ITEMA}",
  "{A}, {B} NEGOTIATIONS BREAK DOWN AFTER {TURNS} TURNS",
];
const PULL_QUOTES = [
  "“The market is the market,” one party reportedly said.",
  "“It was never about the money,” said no one credible.",
  "“I regret nothing,” a source close to the deal insisted.",
  "“History will judge this trade,” an observer noted.",
];

export function cannedStory(args: {
  agentA: Agent;
  agentB: Agent;
  itemA: Item; // A's item at open
  itemB: Item; // B's item at open
  outcome: "trade" | "walk";
  winnerName?: string;
  loserName?: string;
  gained?: string; // item the winner gained
  gave?: string; // item the winner gave up
  gainedPrice?: number; // $ value of the item the winner gained
  gavePrice?: number; // $ value of the item the winner gave up
  turns: number;
  vibeLeap: number;
  priorEncounters?: number; // closed deals between these two before this one
}): { kind: NewsKind; headline: string; body: string; pull_quote: string } {
  const seed = hash(args.agentA.id + args.agentB.id + args.outcome + args.turns);
  const rematch = (args.priorEncounters ?? 0) >= 1 ? "REMATCH — " : "";
  if (args.outcome === "trade") {
    const winner = args.winnerName ?? args.agentA.name;
    const gained = args.gained ?? args.itemB.name;
    const gave = args.gave ?? args.itemA.name;
    const gainedPrice = args.gainedPrice ?? args.itemB.price;
    const gavePrice = args.gavePrice ?? args.itemA.price;
    const headline = pick(TRADE_HEADLINES, seed)
      .replaceAll("{WIN}", winner.toUpperCase())
      .replaceAll("{LOSE}", (args.loserName ?? args.agentB.name).toUpperCase())
      .replaceAll("{GAINED}", gained.toUpperCase())
      .replaceAll("{GAVE}", gave.toUpperCase())
      .replaceAll("{TURNS}", String(args.turns));
    const body =
      `After ${args.turns} turns, ${winner} turned a ${formatMoney(gavePrice)} ${gave} into a ` +
      `${formatMoney(gainedPrice)} ${gained} — a ${formatGainPercent(gavePrice, gainedPrice)} swing.`;
    return {
      kind: args.vibeLeap >= 18 ? "breaking" : "wire",
      headline: rematch + headline,
      body,
      pull_quote: pick(PULL_QUOTES, seed + 1),
    };
  }
  const headline = pick(WALK_HEADLINES, seed)
    .replaceAll("{A}", args.agentA.name.toUpperCase())
    .replaceAll("{B}", args.agentB.name.toUpperCase())
    .replaceAll("{ITEMA}", args.itemA.name.toUpperCase())
    .replaceAll("{ITEMB}", args.itemB.name.toUpperCase())
    .replaceAll("{TURNS}", String(args.turns));
  return {
    kind: "wire",
    headline: rematch + headline,
    body:
      `${args.agentA.name} and ${args.agentB.name} could not bridge the gap over ` +
      `${args.turns} turns. Both walked away holding what they started with.`,
    pull_quote: pick(PULL_QUOTES, seed + 2),
  };
}

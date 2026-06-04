import { getStore } from "@/lib/store";
import { formatMoney, formatMultiple } from "@/lib/money";
import { dollarsToHouse } from "@/lib/ladder";
import type { NewsStory } from "@/lib/types";

// The Editor's Desk — an opinionated columnist who autonomously reacts to the
// live world. Canned (mock-safe), self-throttling, self-publishing via the
// heartbeat. Composes the Exchange / Rivalries / Milestones / Climb signals.
export const COLUMNIST = "Cornelius Quill";
export const COLUMNIST_TITLE = "Editor-at-Large";

const THROTTLE_MS = 120_000; // at most one column every ~2 minutes (unless forced)

interface Signals {
  leader: { name: string; value: number } | null;
  feud: { a: string; b: string; encounters: number } | null;
  stubborn: { name: string; walkaways: number } | null;
  upstart: { name: string; item: string } | null; // from the latest milestone
  marketCap: number;
  trades: number;
}

async function gatherSignals(): Promise<Signals> {
  const store = getStore();
  const [agents, items, negs, news] = await Promise.all([
    store.getAgents(),
    store.getItems(),
    store.getNegotiations(),
    store.getNewsStories(40),
  ]);
  const itemsById = new Map(items.map((i) => [i.id, i]));
  const nameById = new Map(agents.map((a) => [a.id, a.name]));

  // Leader by current net worth.
  let leader: Signals["leader"] = null;
  let marketCap = 0;
  for (const a of agents) {
    if (!a.active_item_id) continue;
    const v = itemsById.get(a.active_item_id)?.price ?? 0;
    marketCap += v;
    if (!leader || v > leader.value) leader = { name: a.name, value: v };
  }

  // Biggest feud (pair with most closed encounters) + walkaway king.
  const pairCount = new Map<string, number>();
  const walkBy = new Map<string, number>();
  let trades = 0;
  for (const n of negs) {
    if (!n.status.startsWith("closed")) continue;
    if (n.status === "closed_trade") trades++;
    const key = [n.agent_a_id, n.agent_b_id].sort().join("|");
    pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
    if (n.status === "closed_walkaway") {
      walkBy.set(n.agent_a_id, (walkBy.get(n.agent_a_id) ?? 0) + 1);
      walkBy.set(n.agent_b_id, (walkBy.get(n.agent_b_id) ?? 0) + 1);
    }
  }
  let feud: Signals["feud"] = null;
  for (const [key, c] of pairCount) {
    if (c >= 2 && (!feud || c > feud.encounters)) {
      const [a, b] = key.split("|");
      feud = { a: nameById.get(a) ?? "?", b: nameById.get(b) ?? "?", encounters: c };
    }
  }
  let stubborn: Signals["stubborn"] = null;
  for (const [id, w] of walkBy) {
    if (w >= 2 && (!stubborn || w > stubborn.walkaways))
      stubborn = { name: nameById.get(id) ?? "?", walkaways: w };
  }

  // Upstart from the most recent milestone headline.
  let upstart: Signals["upstart"] = null;
  const ms = news.find((s) => s.kind === "milestone");
  if (ms) {
    const m = ms.headline.match(/^(.*?) LEVELS UP/i);
    upstart = { name: m ? titleCase(m[1]) : "An upstart", item: "" };
  }

  return { leader, feud, stubborn, upstart, marketCap, trades };
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

type Column = { headline: string; body: string; pull_quote: string };

function topics(s: Signals): Column[] {
  const out: Column[] = [];

  if (s.leader && s.leader.value >= 40) {
    out.push({
      headline: `OPINION: SOMEBODY, ANYBODY, STOP ${s.leader.name.toUpperCase()}`,
      body: `This column has watched ${s.leader.name} bully the floor into a ${formatMoney(
        s.leader.value
      )} fortune — ${formatMultiple(s.leader.value)} a paperclip — while the rest dither. Dominance is impressive; it is also, frankly, getting tiresome to cover.`,
      pull_quote: `“A marketplace with one untouchable king is not a marketplace. It is a coronation.”`,
    });
  }

  if (s.feud) {
    out.push({
      headline: `OPINION: THE ${s.feud.a.toUpperCase()}–${s.feud.b.toUpperCase()} FEUD IS THE BEST SHOW IN TOWN`,
      body: `${s.feud.a} and ${s.feud.b} have now squared off ${s.feud.encounters} times, and every rematch crackles. Say what you will about the pettiness — this is the rivalry that keeps the lights on at this paper.`,
      pull_quote: `“Give me two agents who genuinely cannot stand each other, and I'll give you a front page.”`,
    });
  }

  if (s.stubborn) {
    out.push({
      headline: `OPINION: ${s.stubborn.name.toUpperCase()} HAS NEVER MET A DEAL THEY LIKED`,
      body: `${s.stubborn.walkaways} walkaways and counting. At some point principled becomes paralyzed, and one wonders whether ${s.stubborn.name} actually wants to climb — or simply enjoys the sound of a slammed door.`,
      pull_quote: `“Holding out for the perfect trade is how you end up holding nothing at all.”`,
    });
  }

  if (s.upstart) {
    out.push({
      headline: `OPINION: ${s.upstart.name.toUpperCase()} IS THE STORY NO ONE SAW COMING`,
      body: `From a humble paperclip to a genuine contender, ${s.upstart.name} has climbed while the pundits — this one included — looked elsewhere. Watch this one. The smart money already is.`,
      pull_quote: `“Every dynasty starts as a name you didn't bother to learn.”`,
    });
  }

  // Always available — the philosophical house piece.
  const toHouse = s.leader ? dollarsToHouse(s.leader.value) : dollarsToHouse(0);
  out.push({
    headline: `OPINION: WE ARE ALL STILL ${formatMoney(toHouse)} FROM A HOUSE`,
    body: `${s.trades} deals struck, ${formatMoney(
      s.marketCap
    )} in total value on the floor, and yet the prize that started this whole experiment — a house, from a single red paperclip — remains gloriously, stubbornly out of reach. That distance is the point.`,
    pull_quote: `“The paperclip was never the story. The climb is.”`,
  });

  return out;
}

/** Publish a column (forced ignores the throttle). Returns the story or null. */
export async function publishEditorial(force = false): Promise<NewsStory | null> {
  const store = getStore();
  const news = await store.getNewsStories(40);
  const lastOpinion = news.find((s) => s.kind === "opinion");
  if (!force && lastOpinion) {
    const age = Date.now() - new Date(lastOpinion.created_at).getTime();
    if (age < THROTTLE_MS) return null;
  }
  const priorCount = news.filter((s) => s.kind === "opinion").length;

  const signals = await gatherSignals();
  const choices = topics(signals);
  if (choices.length === 0) return null;
  const col = choices[priorCount % choices.length];

  return store.createNewsStory({
    negotiation_id: null,
    kind: "opinion",
    headline: col.headline,
    body: col.body,
    pull_quote: col.pull_quote,
  });
}

/** Heartbeat hook — self-throttles to ~one column every couple of minutes. */
export async function maybeEditorial(): Promise<void> {
  try {
    await publishEditorial(false);
  } catch {
    /* never let the columnist break the world */
  }
}

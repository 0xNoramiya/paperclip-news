import { getStore } from "@/lib/store";

// Head-to-head history between agents, derived on the fly from closed
// negotiations. As the 24/7 world re-pairs the same agents, grudges accumulate.
export interface LastEncounter {
  negotiationId: string;
  traded: boolean;
  winnerId: string | null;
  at: string;
  summary: string;
}
export interface Relationship {
  encounters: number; // closed negotiations between the two
  walkaways: number;
  wins: Record<string, number>; // agentId -> trade-wins (came out ahead on value)
  last: LastEncounter | null;
}

// The value winner of a closed trade: whoever's new holding is worth more than
// what they gave (A gave item_a → got item_b; B the reverse).
function tradeWinner(
  agentAId: string,
  agentBId: string,
  priceA: number,
  priceB: number
): string | null {
  const gainA = priceB - priceA;
  if (gainA > 0) return agentAId;
  if (gainA < 0) return agentBId;
  return null;
}

export async function getRelationship(
  aId: string,
  bId: string
): Promise<Relationship> {
  const store = getStore();
  const [negs, items, agents] = await Promise.all([
    store.getNegotiations(),
    store.getItems(),
    store.getAgents(),
  ]);
  const priceById = new Map(items.map((i) => [i.id, i.price]));
  const nameById = new Map(agents.map((a) => [a.id, a.name]));

  const between = negs
    .filter(
      (n) =>
        n.status.startsWith("closed") &&
        ((n.agent_a_id === aId && n.agent_b_id === bId) ||
          (n.agent_a_id === bId && n.agent_b_id === aId))
    )
    .sort((x, y) => x.created_at.localeCompare(y.created_at));

  const wins: Record<string, number> = {};
  let walkaways = 0;
  let last: LastEncounter | null = null;

  for (const n of between) {
    if (n.status === "closed_trade") {
      const pa = priceById.get(n.item_a_id) ?? 0;
      const pb = priceById.get(n.item_b_id) ?? 0;
      const winnerId = tradeWinner(n.agent_a_id, n.agent_b_id, pa, pb);
      if (winnerId) wins[winnerId] = (wins[winnerId] ?? 0) + 1;
      const gainedName =
        winnerId === n.agent_a_id
          ? items.find((i) => i.id === n.item_b_id)?.name
          : items.find((i) => i.id === n.item_a_id)?.name;
      last = {
        negotiationId: n.id,
        traded: true,
        winnerId,
        at: n.closed_at ?? n.created_at,
        summary: winnerId
          ? `${nameById.get(winnerId)} took the ${gainedName ?? "item"}`
          : "an even swap",
      };
    } else {
      walkaways += 1;
      last = {
        negotiationId: n.id,
        traded: false,
        winnerId: null,
        at: n.closed_at ?? n.created_at,
        summary: "talks collapsed",
      };
    }
  }

  return { encounters: between.length, walkaways, wins, last };
}

export function headToHead(rel: Relationship, aId: string, bId: string) {
  return {
    encounters: rel.encounters,
    walkaways: rel.walkaways,
    aWins: rel.wins[aId] ?? 0,
    bWins: rel.wins[bId] ?? 0,
  };
}

// LLM system-prompt note, written from `selfId`'s point of view.
export function promptNote(
  rel: Relationship,
  selfId: string,
  oppName: string
): string | null {
  if (rel.encounters === 0) return null;
  const self = rel.wins[selfId] ?? 0;
  const opp = Object.entries(rel.wins)
    .filter(([id]) => id !== selfId)
    .reduce((s, [, c]) => s + c, 0);
  const stance =
    self > opp
      ? `you've usually come out ahead (${self}-${opp})`
      : self < opp
        ? `they've usually gotten the better of you (${opp}-${self})`
        : `you're evenly matched (${self}-${opp})`;
  return `HISTORY WITH ${oppName.toUpperCase()}: You've closed ${rel.encounters} deal(s) with them before — ${stance}${
    rel.walkaways ? `, plus ${rel.walkaways} walkaway(s)` : ""
  }. Last time: ${rel.last?.summary}. Let that history color your tone — a grudge, a swagger, or wary respect — and feel free to reference it.`;
}

// Canned in-character opener that references the rivalry (no LLM needed).
export function cannedMemoryOpener(
  rel: Relationship,
  selfId: string,
  oppName: string,
  myItemName: string,
  theirItemName: string
): string | null {
  if (rel.encounters === 0) return null;
  const self = rel.wins[selfId] ?? 0;
  const opp = Object.entries(rel.wins)
    .filter(([id]) => id !== selfId)
    .reduce((s, [, c]) => s + c, 0);
  if (self > opp)
    return `Well, well — ${oppName} again. I cleaned you out last time. Back for more? My ${myItemName} for your ${theirItemName}.`;
  if (self < opp)
    return `You. ${oppName}. You fleeced me last round and I haven't forgotten. ${myItemName} for ${theirItemName} — and this time I'm watching you.`;
  return `${oppName}. We keep circling each other. Round ${rel.encounters + 1}: my ${myItemName} for your ${theirItemName}. Let's settle it.`;
}

// Per-agent rivalries for the agent page.
export interface RivalRow {
  opponentId: string;
  opponentName: string;
  opponentAvatar: string;
  encounters: number;
  wins: number; // this agent's wins
  losses: number;
  walkaways: number;
  lastSummary: string | null;
  label: string; // "nemesis" | "favorite mark" | "even rivalry"
}

export async function getAgentRivalries(agentId: string): Promise<RivalRow[]> {
  const store = getStore();
  const [negs, items, agents] = await Promise.all([
    store.getNegotiations(),
    store.getItems(),
    store.getAgents(),
  ]);
  const priceById = new Map(items.map((i) => [i.id, i.price]));
  const agentById = new Map(agents.map((a) => [a.id, a]));

  interface Acc {
    encounters: number;
    wins: number;
    losses: number;
    walkaways: number;
    lastAt: string;
    lastSummary: string;
  }
  const byOpp = new Map<string, Acc>();

  for (const n of negs) {
    if (!n.status.startsWith("closed")) continue;
    if (n.agent_a_id !== agentId && n.agent_b_id !== agentId) continue;
    const oppId = n.agent_a_id === agentId ? n.agent_b_id : n.agent_a_id;
    const acc =
      byOpp.get(oppId) ??
      { encounters: 0, wins: 0, losses: 0, walkaways: 0, lastAt: "", lastSummary: "" };
    acc.encounters += 1;
    let summary = "talks collapsed";
    if (n.status === "closed_trade") {
      const pa = priceById.get(n.item_a_id) ?? 0;
      const pb = priceById.get(n.item_b_id) ?? 0;
      const winnerId = tradeWinner(n.agent_a_id, n.agent_b_id, pa, pb);
      if (winnerId === agentId) {
        acc.wins += 1;
        summary = "you came out ahead";
      } else if (winnerId === oppId) {
        acc.losses += 1;
        summary = "they came out ahead";
      } else summary = "an even swap";
    } else acc.walkaways += 1;
    const at = n.closed_at ?? n.created_at;
    if (at >= acc.lastAt) {
      acc.lastAt = at;
      acc.lastSummary = summary;
    }
    byOpp.set(oppId, acc);
  }

  const rows: RivalRow[] = [...byOpp.entries()].map(([oppId, acc]) => {
    const opp = agentById.get(oppId);
    const label =
      acc.wins > acc.losses
        ? "favorite mark"
        : acc.wins < acc.losses
          ? "nemesis"
          : "even rivalry";
    return {
      opponentId: oppId,
      opponentName: opp?.name ?? "?",
      opponentAvatar: opp?.avatar ?? "🤖",
      encounters: acc.encounters,
      wins: acc.wins,
      losses: acc.losses,
      walkaways: acc.walkaways,
      lastSummary: acc.lastSummary || null,
      label,
    };
  });

  return rows.sort((x, y) => y.encounters - x.encounters);
}

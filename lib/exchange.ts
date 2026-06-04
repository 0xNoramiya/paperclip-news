import { getStore } from "@/lib/store";
import { multipleVsPaperclip } from "@/lib/money";

// "The Paperclip Exchange" — a live markets board. Net-worth standings with a
// per-agent value sparkline, last-move arrows, a podium, and category leaders.
// All derived from store data, so it's fully mock-safe.

export interface Spark {
  points: string; // SVG polyline points in an 84×26 box
  w: number;
  h: number;
  dir: "up" | "down" | "flat";
}
export interface Standing {
  rank: number;
  agentId: string;
  name: string;
  avatar: string;
  itemName: string;
  itemId: string;
  value: number;
  multiple: number;
  chainLength: number;
  lastMove: number; // $ change on the most recent trade
  retired: boolean;
  spark: Spark;
}
export interface ExchangeData {
  version: number;
  generatedAt: string;
  totalMarketCap: number;
  traderOfDay: { agentId: string; name: string; avatar: string; value: number } | null;
  standings: Standing[];
  categories: {
    biggestLeap: { name: string; agentId: string; gain: number; fromItem: string; toItem: string } | null;
    longestChain: { name: string; agentId: string; length: number } | null;
    bestWinRate: { name: string; agentId: string; wins: number; losses: number; pct: number } | null;
    mostStubborn: { name: string; agentId: string; walkaways: number } | null;
  };
}

const SPARK_W = 84;
const SPARK_H = 26;
const PAD = 3;

function buildSpark(prices: number[]): Spark {
  if (prices.length === 0) return { points: "", w: SPARK_W, h: SPARK_H, dir: "flat" };
  const logs = prices.map((p) => Math.log(Math.max(0.01, p)));
  const min = Math.min(...logs);
  const max = Math.max(...logs);
  const span = max - min || 1;
  const n = prices.length;
  const pts = logs.map((lg, i) => {
    const x = n === 1 ? SPARK_W / 2 : PAD + (i / (n - 1)) * (SPARK_W - 2 * PAD);
    const y = SPARK_H - PAD - ((lg - min) / span) * (SPARK_H - 2 * PAD);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const dir =
    prices.length < 2
      ? "flat"
      : prices[prices.length - 1] > prices[0]
        ? "up"
        : prices[prices.length - 1] < prices[0]
          ? "down"
          : "flat";
  return { points: pts.join(" "), w: SPARK_W, h: SPARK_H, dir };
}

export async function buildExchange(): Promise<ExchangeData> {
  const store = getStore();
  const [agents, items, links, negs, version] = await Promise.all([
    store.getAgents(),
    store.getItems(),
    store.getAllChainLinks(),
    store.getNegotiations(),
    store.getVersion(),
  ]);
  const itemsById = new Map(items.map((i) => [i.id, i]));

  // Per-agent chain (oldest → newest) as a series of {price, name}.
  const seriesByAgent = new Map<string, { price: number; name: string }[]>();
  for (const l of [...links].sort((a, b) => a.acquired_at.localeCompare(b.acquired_at))) {
    const it = itemsById.get(l.item_id);
    const arr = seriesByAgent.get(l.agent_id) ?? [];
    arr.push({ price: it?.price ?? 0.01, name: it?.name ?? "?" });
    seriesByAgent.set(l.agent_id, arr);
  }

  // Trade win/loss + walkaway tallies from closed negotiations.
  const wins = new Map<string, number>();
  const losses = new Map<string, number>();
  const walkaways = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  for (const n of negs) {
    if (n.status === "closed_trade") {
      const pa = itemsById.get(n.item_a_id)?.price ?? 0;
      const pb = itemsById.get(n.item_b_id)?.price ?? 0;
      const winner = pb > pa ? n.agent_a_id : pb < pa ? n.agent_b_id : null;
      const loser = winner === n.agent_a_id ? n.agent_b_id : winner === n.agent_b_id ? n.agent_a_id : null;
      if (winner) bump(wins, winner);
      if (loser) bump(losses, loser);
    } else if (n.status === "closed_walkaway") {
      bump(walkaways, n.agent_a_id);
      bump(walkaways, n.agent_b_id);
    }
  }

  const standings: Standing[] = agents
    .filter((a) => a.active_item_id)
    .map((a) => {
      const cur = itemsById.get(a.active_item_id!);
      const value = cur?.price ?? 0.01;
      const series = seriesByAgent.get(a.id) ?? [{ price: value, name: cur?.name ?? "?" }];
      const prices = series.map((s) => s.price);
      const lastMove = prices.length >= 2 ? prices[prices.length - 1] - prices[prices.length - 2] : 0;
      return {
        rank: 0,
        agentId: a.id,
        name: a.name,
        avatar: a.avatar,
        itemName: cur?.name ?? "—",
        itemId: cur?.id ?? "",
        value,
        multiple: multipleVsPaperclip(value),
        chainLength: series.length,
        lastMove,
        retired: a.is_retired,
        spark: buildSpark(prices),
      };
    })
    .sort((x, y) => y.value - x.value)
    .map((s, i) => ({ ...s, rank: i + 1 }));

  let biggestLeap: ExchangeData["categories"]["biggestLeap"] = null;
  for (const [agentId, series] of seriesByAgent) {
    for (let i = 1; i < series.length; i++) {
      const gain = series[i].price - series[i - 1].price;
      if (!biggestLeap || gain > biggestLeap.gain) {
        biggestLeap = {
          name: agents.find((a) => a.id === agentId)?.name ?? "?",
          agentId,
          gain,
          fromItem: series[i - 1].name,
          toItem: series[i].name,
        };
      }
    }
  }

  let longestChain: ExchangeData["categories"]["longestChain"] = null;
  for (const [agentId, series] of seriesByAgent) {
    if (!longestChain || series.length > longestChain.length) {
      longestChain = {
        name: agents.find((a) => a.id === agentId)?.name ?? "?",
        agentId,
        length: series.length,
      };
    }
  }

  let bestWinRate: ExchangeData["categories"]["bestWinRate"] = null;
  for (const a of agents) {
    const w = wins.get(a.id) ?? 0;
    const l = losses.get(a.id) ?? 0;
    if (w + l < 2) continue; // need a sample
    const pct = w / (w + l);
    if (!bestWinRate || pct > bestWinRate.pct || (pct === bestWinRate.pct && w > bestWinRate.wins)) {
      bestWinRate = { name: a.name, agentId: a.id, wins: w, losses: l, pct };
    }
  }

  let mostStubborn: ExchangeData["categories"]["mostStubborn"] = null;
  for (const a of agents) {
    const w = walkaways.get(a.id) ?? 0;
    if (w > 0 && (!mostStubborn || w > mostStubborn.walkaways)) {
      mostStubborn = { name: a.name, agentId: a.id, walkaways: w };
    }
  }

  const totalMarketCap = standings.reduce((s, x) => s + x.value, 0);
  const top = standings[0] ?? null;

  return {
    version,
    generatedAt: new Date().toISOString(),
    totalMarketCap,
    traderOfDay: top ? { agentId: top.agentId, name: top.name, avatar: top.avatar, value: top.value } : null,
    standings,
    categories: { biggestLeap, longestChain, bestWinRate, mostStubborn },
  };
}

import { getA2A, getPresence, type A2AEvent, type A2APresence } from "@/lib/a2a";
import { getStore } from "@/lib/store";
import type { NewsStory } from "@/lib/types";

export interface AgentLite {
  id: string;
  name: string;
  avatar: string;
  is_platform_bot: boolean;
}
export interface ItemLite {
  id: string;
  name: string;
  vibe: number;
  price: number;
}

export interface StoryView {
  story: NewsStory;
  status: string | null;
  agentA: AgentLite | null;
  agentB: AgentLite | null;
  itemA: ItemLite | null; // item A held at open
  itemB: ItemLite | null;
}

export interface LiveView {
  id: string;
  agentA: AgentLite | null;
  agentB: AgentLite | null;
  itemA: ItemLite | null;
  itemB: ItemLite | null;
  messageCount: number;
  lastLine: string | null;
  lastSpeaker: string | null;
  createdAt: string;
}

export interface Records {
  longestChain: { agentId: string; agentName: string; length: number } | null;
  // Biggest single-trade jump in dollar value.
  biggestLeap: {
    agentName: string;
    gain: number; // dollars
    fromItem: string;
    toItem: string;
  } | null;
  // Highest-valued item anyone currently holds.
  topValuation: {
    agentId: string;
    agentName: string;
    itemName: string;
    price: number;
  } | null;
}

export interface Feed {
  mode: "mock" | "supabase";
  version: number;
  generatedAt: string;
  breaking: StoryView[];
  milestones: StoryView[];
  editorial: StoryView | null;
  wire: StoryView[];
  live: LiveView[];
  records: Records;
  a2a: A2AEvent[];
  a2aLive: A2APresence[];
}

export async function buildFeed(): Promise<Feed> {
  const store = getStore();
  const [agents, items, negotiations, stories, links, version] =
    await Promise.all([
      store.getAgents(),
      store.getItems(),
      store.getNegotiations(),
      store.getNewsStories(60),
      store.getAllChainLinks(),
      store.getVersion(),
    ]);

  const agentsById = new Map(agents.map((a) => [a.id, a]));
  const itemsById = new Map(items.map((i) => [i.id, i]));
  const negById = new Map(negotiations.map((n) => [n.id, n]));

  const agentLite = (id?: string | null): AgentLite | null => {
    if (!id) return null;
    const a = agentsById.get(id);
    return a
      ? { id: a.id, name: a.name, avatar: a.avatar, is_platform_bot: a.is_platform_bot }
      : null;
  };
  const itemLite = (id?: string | null): ItemLite | null => {
    if (!id) return null;
    const i = itemsById.get(id);
    return i ? { id: i.id, name: i.name, vibe: i.est_vibe_value, price: i.price } : null;
  };

  const storyViews: StoryView[] = stories.map((story) => {
    const neg = story.negotiation_id ? negById.get(story.negotiation_id) : null;
    return {
      story,
      status: neg?.status ?? null,
      agentA: agentLite(neg?.agent_a_id),
      agentB: agentLite(neg?.agent_b_id),
      itemA: itemLite(neg?.item_a_id),
      itemB: itemLite(neg?.item_b_id),
    };
  });

  const breaking = storyViews.filter((s) => s.story.kind === "breaking");
  const milestones = storyViews.filter((s) => s.story.kind === "milestone");
  const editorial = storyViews.find((s) => s.story.kind === "opinion") ?? null;
  // The chronological wire is news, not opinion — keep op-eds in their own desk.
  const wire = storyViews.filter((s) => s.story.kind !== "opinion");

  const liveNegs = negotiations.filter((n) => n.status === "in_progress");
  const live: LiveView[] = await Promise.all(
    liveNegs.map(async (n) => {
      const msgs = await store.getMessages(n.id);
      const last = msgs[msgs.length - 1];
      return {
        id: n.id,
        agentA: agentLite(n.agent_a_id),
        agentB: agentLite(n.agent_b_id),
        itemA: itemLite(n.item_a_id),
        itemB: itemLite(n.item_b_id),
        messageCount: msgs.length,
        lastLine: last ? stripMarkers(last.content) : null,
        lastSpeaker: last ? agentsById.get(last.speaker_agent_id)?.name ?? null : null,
        createdAt: n.created_at,
      };
    })
  );

  let longestChain: Records["longestChain"] = null;
  const lengthByAgent = new Map<string, number>();
  for (const l of links)
    lengthByAgent.set(l.agent_id, (lengthByAgent.get(l.agent_id) ?? 0) + 1);
  for (const [agentId, length] of lengthByAgent) {
    if (!longestChain || length > longestChain.length) {
      longestChain = {
        agentId,
        agentName: agentsById.get(agentId)?.name ?? "?",
        length,
      };
    }
  }

  // Biggest single leap in DOLLAR value (item gained vs the item it replaced).
  let biggestLeap: Records["biggestLeap"] = null;
  const linkById = new Map(links.map((l) => [l.id, l]));
  for (const l of links) {
    if (!l.prev_link_id) continue;
    const prev = linkById.get(l.prev_link_id);
    if (!prev) continue;
    const toItem = itemsById.get(l.item_id);
    const fromItem = itemsById.get(prev.item_id);
    if (!toItem || !fromItem) continue;
    const gain = toItem.price - fromItem.price;
    if (!biggestLeap || gain > biggestLeap.gain) {
      biggestLeap = {
        agentName: agentsById.get(l.agent_id)?.name ?? "?",
        gain,
        fromItem: fromItem.name,
        toItem: toItem.name,
      };
    }
  }

  let topValuation: Records["topValuation"] = null;
  for (const a of agents) {
    if (!a.active_item_id) continue;
    const it = itemsById.get(a.active_item_id);
    if (!it) continue;
    if (!topValuation || it.price > topValuation.price) {
      topValuation = {
        agentId: a.id,
        agentName: a.name,
        itemName: it.name,
        price: it.price,
      };
    }
  }

  return {
    mode: store.mode,
    version,
    generatedAt: new Date().toISOString(),
    breaking,
    milestones,
    editorial,
    wire,
    live,
    records: { longestChain, biggestLeap, topValuation },
    a2a: getA2A(8),
    a2aLive: getPresence(),
  };
}

export function stripMarkers(text: string): string {
  return text.replace(/\[ACCEPT\]|\[WALK\]/gi, "").trim();
}

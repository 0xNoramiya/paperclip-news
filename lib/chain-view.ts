import { ORIGIN_PAPERCLIP_ID, ORIGIN_PAPERCLIP_NAME } from "@/lib/constants";
import { getStore } from "@/lib/store";
import type { Agent, ChainLink, Item } from "@/lib/types";

export interface ProvenanceStep {
  agentId: string;
  agentName: string;
  avatar: string;
  itemId: string;
  itemName: string;
  vibe: number;
  price: number;
  fromAgentName: string | null; // null = first holder (grounded on the paperclip)
  viaNegotiationId: string | null;
  acquiredAt: string;
  isOrigin: boolean;
}

export interface ChainLinkView {
  id: string;
  item: { id: string; name: string; vibe: number; price: number; description: string };
  fromAgentId: string | null;
  fromAgentName: string | null;
  viaNegotiationId: string | null;
  headline: string | null; // the newsroom headline of the deal that won this item
  acquiredAt: string;
  // The item's full journey across owners, back to the paperclip.
  provenance: ProvenanceStep[];
}

export interface AgentChainView {
  agent: {
    id: string;
    name: string;
    avatar: string;
    persona: string;
    aggressiveness: number;
    patience: number;
    target_description: string;
    directive: string;
    reputation: number;
    is_platform_bot: boolean;
    is_retired: boolean;
    llm_provider: string;
  };
  currentItem: { id: string; name: string; vibe: number; price: number } | null;
  startPrice: number; // price of the agent's first holding (often $0.01)
  links: ChainLinkView[];
  biggestLeap: number; // best single DOLLAR jump along this chain
}

function traceProvenance(
  start: ChainLink,
  allLinks: ChainLink[],
  agents: Map<string, Agent>,
  items: Map<string, Item>
): ProvenanceStep[] {
  const trail: ProvenanceStep[] = [];
  const guard = new Set<string>();
  let cur: ChainLink | null = start;

  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    const item = items.get(cur.item_id);
    const holder = agents.get(cur.agent_id);
    trail.push({
      agentId: cur.agent_id,
      agentName: holder?.name ?? "?",
      avatar: holder?.avatar ?? "🤖",
      itemId: cur.item_id,
      itemName: item?.name ?? "?",
      vibe: item?.est_vibe_value ?? 0,
      price: item?.price ?? 0,
      fromAgentName: cur.from_agent_id ? agents.get(cur.from_agent_id)?.name ?? null : null,
      viaNegotiationId: cur.via_negotiation_id,
      acquiredAt: cur.acquired_at,
      isOrigin: !cur.from_agent_id,
    });
    if (!cur.from_agent_id) break; // first holder — grounded on the paperclip

    // Find where this item came from: the donor's holding of the same item,
    // the latest one at or before this acquisition.
    const fromId: string = cur.from_agent_id;
    const itemId: string = cur.item_id;
    const acquiredAt: string = cur.acquired_at;
    const candidates = allLinks
      .filter(
        (l) =>
          l.agent_id === fromId &&
          l.item_id === itemId &&
          l.acquired_at <= acquiredAt
      )
      .sort((a, b) => b.acquired_at.localeCompare(a.acquired_at));
    cur = candidates[0] ?? null;
  }
  return trail;
}

export async function getAgentChainView(
  agentId: string
): Promise<AgentChainView | null> {
  const store = getStore();
  const agent = await store.getAgent(agentId);
  if (!agent) return null;

  const [agents, items, allLinks, chain, news] = await Promise.all([
    store.getAgents(),
    store.getItems(),
    store.getAllChainLinks(),
    store.getAgentChain(agentId),
    store.getNewsStories(500),
  ]);
  const agentsById = new Map(agents.map((a) => [a.id, a]));
  const itemsById = new Map(items.map((i) => [i.id, i]));
  // Headline per negotiation — prefer the descriptive TRADE story over a
  // celebratory milestone bulletin for the same deal.
  const headlineByNeg = new Map<string, string>();
  const milestoneByNeg = new Map<string, string>();
  for (const s of news) {
    if (!s.negotiation_id) continue;
    if (s.kind === "milestone") {
      if (!milestoneByNeg.has(s.negotiation_id)) milestoneByNeg.set(s.negotiation_id, s.headline);
    } else if (!headlineByNeg.has(s.negotiation_id)) {
      headlineByNeg.set(s.negotiation_id, s.headline);
    }
  }
  for (const [neg, h] of milestoneByNeg) if (!headlineByNeg.has(neg)) headlineByNeg.set(neg, h);

  const links: ChainLinkView[] = chain.map((l) => {
    const item = itemsById.get(l.item_id);
    return {
      id: l.id,
      item: {
        id: l.item_id,
        name: item?.name ?? "?",
        vibe: item?.est_vibe_value ?? 0,
        price: item?.price ?? 0,
        description: item?.description ?? "",
      },
      fromAgentId: l.from_agent_id,
      fromAgentName: l.from_agent_id ? agentsById.get(l.from_agent_id)?.name ?? null : null,
      viaNegotiationId: l.via_negotiation_id,
      headline: l.via_negotiation_id ? headlineByNeg.get(l.via_negotiation_id) ?? null : null,
      acquiredAt: l.acquired_at,
      provenance: traceProvenance(l, allLinks, agentsById, itemsById),
    };
  });

  // Biggest single DOLLAR leap along this agent's own chain.
  let biggestLeap = 0;
  for (let i = 1; i < links.length; i++) {
    biggestLeap = Math.max(biggestLeap, links[i].item.price - links[i - 1].item.price);
  }

  const cur = agent.active_item_id ? itemsById.get(agent.active_item_id) : null;

  return {
    agent: {
      id: agent.id,
      name: agent.name,
      avatar: agent.avatar,
      persona: agent.persona,
      aggressiveness: agent.aggressiveness,
      patience: agent.patience,
      target_description: agent.target_description,
      directive: agent.directive,
      reputation: agent.reputation,
      is_platform_bot: agent.is_platform_bot,
      is_retired: agent.is_retired,
      llm_provider: agent.llm_provider,
    },
    currentItem: cur
      ? { id: cur.id, name: cur.name, vibe: cur.est_vibe_value, price: cur.price }
      : null,
    startPrice: links[0]?.item.price ?? 0.01,
    links,
    biggestLeap,
  };
}

export { ORIGIN_PAPERCLIP_ID, ORIGIN_PAPERCLIP_NAME };

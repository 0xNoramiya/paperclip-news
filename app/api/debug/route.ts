import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

// Quick visibility into the seeded/evolving world. GET /api/debug
export async function GET() {
  const store = getStore();
  const [agents, items, negotiations, news, links] = await Promise.all([
    store.getAgents(),
    store.getItems(),
    store.getNegotiations(),
    store.getNewsStories(20),
    store.getAllChainLinks(),
  ]);

  const itemsById = new Map(items.map((i) => [i.id, i]));
  const agentsById = new Map(agents.map((a) => [a.id, a]));
  const linkCountByAgent = new Map<string, number>();
  for (const l of links)
    linkCountByAgent.set(l.agent_id, (linkCountByAgent.get(l.agent_id) ?? 0) + 1);

  const negSummaries = await Promise.all(
    negotiations.slice(0, 20).map(async (n) => ({
      id: n.id,
      status: n.status,
      a: agentsById.get(n.agent_a_id)?.name,
      b: agentsById.get(n.agent_b_id)?.name,
      messages: (await store.getMessages(n.id)).length,
      winner_note: n.winner_note,
    }))
  );

  return NextResponse.json({
    mode: store.mode,
    hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
    counts: {
      agents: agents.length,
      items: items.length,
      negotiations: negotiations.length,
      news: news.length,
      chainLinks: links.length,
    },
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      avatar: a.avatar,
      holds: a.active_item_id ? itemsById.get(a.active_item_id)?.name ?? "?" : null,
      chainLength: linkCountByAgent.get(a.id) ?? 0,
      reputation: a.reputation,
      is_platform_bot: a.is_platform_bot,
      // Tokens are secrets — never exposed here. Platform-bot tokens are
      // documented in MCP.md; reader/BYO tokens are shown only on creation.
    })),
    negotiations: negSummaries,
    news: news.map((s) => ({ kind: s.kind, headline: s.headline })),
  });
}

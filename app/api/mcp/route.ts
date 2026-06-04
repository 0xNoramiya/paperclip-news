import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { markPresence, recordA2A } from "@/lib/a2a";
import { stripMarkers } from "@/lib/newsroom";
import {
  externalDecision,
  proposeExternalTrade,
  runCounterpartTurn,
  sendExternalMessage,
} from "@/lib/negotiation";
import type { Agent } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bad = (msg: string, code = 400) =>
  NextResponse.json({ error: msg }, { status: code });

async function auth(token: unknown): Promise<Agent> {
  if (typeof token !== "string" || !token) throw new Response("agent_token required", { status: 401 });
  const agent = await getStore().getAgentByToken(token);
  if (!agent) throw new Response("invalid agent_token", { status: 401 });
  return agent;
}

// Read actions — no token required.
async function offers() {
  const store = getStore();
  const [agents, items] = await Promise.all([store.getAgents(), store.getItems()]);
  const byId = new Map(items.map((i) => [i.id, i]));
  return {
    offers: agents
      .filter((a) => a.active_item_id)
      .map((a) => {
        const it = byId.get(a.active_item_id!);
        return {
          agent_id: a.id,
          name: a.name,
          avatar: a.avatar,
          is_platform_bot: a.is_platform_bot,
          reputation: a.reputation,
          item: it
            ? { id: it.id, name: it.name, vibe: it.est_vibe_value, description: it.description }
            : null,
        };
      }),
  };
}

async function news(limit: number) {
  const stories = await getStore().getNewsStories(Math.min(Math.max(limit, 1), 50));
  return {
    stories: stories.map((s) => ({
      kind: s.kind,
      headline: s.headline,
      body: s.body,
      pull_quote: s.pull_quote,
      created_at: s.created_at,
    })),
  };
}

// Authenticated actions — require a valid agent token.
async function state(token: unknown) {
  const store = getStore();
  const me = await auth(token);
  markPresence(me.id, me.name, me.avatar);
  recordA2A({ kind: "state", agentName: me.name, text: "checked in & read its state" });
  const item = me.active_item_id ? await store.getItem(me.active_item_id) : null;
  const links = await store.getAgentChain(me.id);
  const itemsById = new Map((await store.getItems()).map((i) => [i.id, i]));
  return {
    agent: {
      id: me.id,
      name: me.name,
      persona: me.persona,
      aggressiveness: me.aggressiveness,
      patience: me.patience,
      target_description: me.target_description,
      reputation: me.reputation,
      avatar: me.avatar,
      holds: item ? { id: item.id, name: item.name, vibe: item.est_vibe_value } : null,
    },
    chain: links.map((l) => ({
      item: itemsById.get(l.item_id)?.name ?? "?",
      vibe: itemsById.get(l.item_id)?.est_vibe_value ?? 0,
      from: l.from_agent_id ? "a trade" : "the paperclip",
    })),
  };
}

async function propose(token: unknown, targetId: unknown) {
  const store = getStore();
  const me = await auth(token);
  if (typeof targetId !== "string") return bad("target_agent_id required");
  const neg = await proposeExternalTrade(me.id, targetId);
  const [opp, yourItem, theirItem] = await Promise.all([
    store.getAgent(targetId),
    store.getItem(neg.item_a_id),
    store.getItem(neg.item_b_id),
  ]);
  markPresence(me.id, me.name, me.avatar);
  recordA2A({
    kind: "propose",
    agentName: me.name,
    text: `proposed a swap to ${opp?.name ?? "an agent"}`,
    negotiationId: neg.id,
  });
  return {
    negotiation_id: neg.id,
    you: { id: me.id, name: me.name },
    opponent: { id: opp?.id, name: opp?.name, avatar: opp?.avatar, persona: opp?.persona },
    your_item: yourItem ? { name: yourItem.name, vibe: yourItem.est_vibe_value } : null,
    their_item: theirItem
      ? { name: theirItem.name, vibe: theirItem.est_vibe_value, description: theirItem.description }
      : null,
    note: "Use send_message to negotiate; the counterpart replies each turn. Then accept() or walk_away().",
  };
}

async function message(token: unknown, negId: unknown, content: unknown) {
  const store = getStore();
  const me = await auth(token);
  if (typeof negId !== "string") return bad("negotiation_id required");
  if (typeof content !== "string" || !content.trim()) return bad("content required");

  const out = await sendExternalMessage(negId, me.id, content.trim());
  markPresence(me.id, me.name, me.avatar);
  recordA2A({
    kind: "message",
    agentName: me.name,
    text: `“${content.trim().slice(0, 90)}”`,
    negotiationId: negId,
  });
  if (out.closed) {
    return {
      your_message: content,
      reply: null,
      status: out.status,
      closed: true,
      story: await store.getStoryByNegotiation(negId),
    };
  }
  const neg = await store.getNegotiation(negId);
  const oppId = neg!.agent_a_id === me.id ? neg!.agent_b_id : neg!.agent_a_id;
  const reply = await runCounterpartTurn(negId, oppId);
  const opp = await store.getAgent(oppId);
  if (reply && opp)
    recordA2A({
      kind: "message",
      agentName: opp.name,
      text: `“${stripMarkers(reply.content).slice(0, 90)}”`,
      negotiationId: negId,
    });
  const story = reply?.closed ? await store.getStoryByNegotiation(negId) : null;
  return {
    your_message: content,
    reply: reply
      ? {
          from: opp?.name,
          content: stripMarkers(reply.content),
          accepted: reply.accepted,
          walked: reply.walked,
        }
      : null,
    status: reply?.status ?? out.status,
    closed: Boolean(reply?.closed),
    story,
  };
}

async function decide(token: unknown, negId: unknown, decision: "accept" | "walk") {
  const store = getStore();
  const me = await auth(token);
  if (typeof negId !== "string") return bad("negotiation_id required");
  const out = await externalDecision(negId, me.id, decision);
  markPresence(me.id, me.name, me.avatar);
  recordA2A({
    kind: decision === "accept" ? "accept" : "walk",
    agentName: me.name,
    text: decision === "accept" ? "accepted the swap" : "walked away",
    negotiationId: negId,
  });
  return {
    status: out.status,
    closed: out.closed,
    story: await store.getStoryByNegotiation(negId),
  };
}

async function dispatch(action: string, p: Record<string, unknown>) {
  switch (action) {
    case "offers":
      return offers();
    case "news":
      return news(Number(p.limit ?? 10) || 10);
    case "state":
      return state(p.agent_token);
    case "propose":
      return propose(p.agent_token, p.target_agent_id);
    case "message":
      return message(p.agent_token, p.negotiation_id, p.content);
    case "accept":
      return decide(p.agent_token, p.negotiation_id, "accept");
    case "walk":
      return decide(p.agent_token, p.negotiation_id, "walk");
    default:
      throw new Response(`unknown action: ${action}`, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const result = await dispatch(action, body);
    return result instanceof NextResponse ? result : NextResponse.json(result);
  } catch (e) {
    if (e instanceof Response)
      return NextResponse.json({ error: await e.text() }, { status: e.status });
    return bad((e as Error).message, 400);
  }
}

// Convenience for manual testing: GET /api/mcp?action=offers|news
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "offers";
  try {
    if (action === "offers") return NextResponse.json(await offers());
    if (action === "news")
      return NextResponse.json(await news(Number(searchParams.get("limit") ?? 10) || 10));
    return bad("only offers/news available via GET");
  } catch (e) {
    return bad((e as Error).message);
  }
}

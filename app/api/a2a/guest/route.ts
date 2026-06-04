import { NextResponse } from "next/server";
import { ORIGIN_PAPERCLIP_ID, PAPERCLIP_PRICE } from "@/lib/constants";
import { markPresence, recordA2A } from "@/lib/a2a";
import { stripMarkers } from "@/lib/newsroom";
import {
  externalDecision,
  proposeExternalTrade,
  runCounterpartTurn,
  sendExternalMessage,
} from "@/lib/negotiation";
import { getStore } from "@/lib/store";
import type { Store } from "@/lib/store";
import type { Agent } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GUEST_TOKEN = "pk_guest_a2a";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const g = globalThis as unknown as { __paperclip_guest_busy?: boolean };

async function ensureGuest(store: Store): Promise<Agent> {
  const found = await store.getAgentByToken(GUEST_TOKEN);
  if (found) return found;
  const item = await store.createItem({
    name: "Red Paperclip",
    description: "The guest arrived with nothing but a single red paperclip. As one does.",
    photo_url: null,
    est_vibe_value: 1,
    price: PAPERCLIP_PRICE,
    created_by: null,
  });
  const agent = await store.createAgent({
    user_id: null,
    name: "The Visitor",
    persona: "An external agent that connected from the outside world to play.",
    aggressiveness: 62,
    patience: 50,
    target_description: "Trade up from nothing, for the story.",
    directive: "",
    reputation: 0,
    is_platform_bot: false,
    is_retired: false,
    token: GUEST_TOKEN,
    llm_provider: "canned",
    llm_model: null,
    avatar: "🛸",
    active_item_id: item.id,
  });
  await store.createChainLink({
    agent_id: agent.id,
    item_id: item.id,
    prev_link_id: null,
    from_agent_id: null,
    via_negotiation_id: null,
  });
  return agent;
}

// Send in a guest "external" agent that drives the REAL A2A negotiation path
// (the same code the MCP tools use), streaming into the A2A WIRE. Always works
// in local mock mode — no client setup required.
export async function POST() {
  if (g.__paperclip_guest_busy) return NextResponse.json({ busy: true });
  g.__paperclip_guest_busy = true;
  try {
    const store = getStore();
    const guest = await ensureGuest(store);

    const [agents, items] = await Promise.all([store.getAgents(), store.getItems()]);
    const itemsById = new Map(items.map((i) => [i.id, i]));
    const candidates = agents.filter(
      (a) =>
        a.is_platform_bot &&
        !a.is_retired &&
        a.active_item_id &&
        a.active_item_id !== ORIGIN_PAPERCLIP_ID &&
        a.id !== guest.id
    );
    if (candidates.length === 0) {
      g.__paperclip_guest_busy = false;
      return NextResponse.json({ error: "no counterpart available" }, { status: 409 });
    }
    const target = candidates[Math.floor(Math.random() * candidates.length)];

    markPresence(guest.id, guest.name, guest.avatar);
    recordA2A({ kind: "connect", agentName: guest.name, text: "connected via MCP from outside" });

    const neg = await proposeExternalTrade(guest.id, target.id);
    const myItem = itemsById.get(neg.item_a_id)?.name ?? "my item";
    const theirItem = itemsById.get(neg.item_b_id)?.name ?? "your item";
    recordA2A({
      kind: "propose",
      agentName: guest.name,
      text: `proposed a swap to ${target.name}`,
      negotiationId: neg.id,
    });

    // Stream the haggle in the background so the A2A WIRE animates.
    (async () => {
      try {
        const lines = [
          `Hi ${target.name} — I connected from my own code. Straight swap: my ${myItem} for your ${theirItem}?`,
          `It's clean, it's fair, and you get a good story on the wire out of it.`,
          `Final offer — and my eternal gratitude. Deal?`,
        ];
        for (const line of lines) {
          await sleep(950);
          const out = await sendExternalMessage(neg.id, guest.id, line);
          markPresence(guest.id, guest.name, guest.avatar);
          recordA2A({
            kind: "message",
            agentName: guest.name,
            text: `“${line.slice(0, 90)}”`,
            negotiationId: neg.id,
          });
          if (out.closed) return;
          const reply = await runCounterpartTurn(neg.id, target.id);
          if (reply)
            recordA2A({
              kind: "message",
              agentName: target.name,
              text: `“${stripMarkers(reply.content).slice(0, 90)}”`,
              negotiationId: neg.id,
            });
          if (reply?.closed) return;
        }
        const now = await store.getNegotiation(neg.id);
        if (now?.status === "in_progress") {
          await sleep(800);
          await externalDecision(neg.id, guest.id, "accept");
          recordA2A({
            kind: "accept",
            agentName: guest.name,
            text: "accepted the swap",
            negotiationId: neg.id,
          });
        }
      } catch (e) {
        console.error("[guest-a2a]", (e as Error).message);
      } finally {
        g.__paperclip_guest_busy = false;
      }
    })();

    return NextResponse.json({
      ok: true,
      negotiationId: neg.id,
      guest: { id: guest.id, name: guest.name, token: GUEST_TOKEN },
    });
  } catch (e) {
    g.__paperclip_guest_busy = false;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

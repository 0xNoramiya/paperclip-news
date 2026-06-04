import { getStore } from "@/lib/store";
import { stripMarkers } from "@/lib/newsroom";
import { getRelationship, headToHead } from "@/lib/rivalry";
import type { NegotiationStatus, NewsStory } from "@/lib/types";

export interface NegAgent {
  id: string;
  name: string;
  avatar: string;
  persona: string;
  is_platform_bot: boolean;
}
export interface NegItem {
  id: string;
  name: string;
  description: string;
  vibe: number;
  price: number;
}
export interface NegMessage {
  id: string;
  side: "A" | "B";
  speakerName: string;
  avatar: string;
  turn: number;
  content: string; // markers stripped
  accepted: boolean;
  walked: boolean;
  createdAt: string;
}

export interface NegotiationView {
  id: string;
  status: NegotiationStatus;
  winner_note: string;
  createdAt: string;
  closedAt: string | null;
  agentA: NegAgent | null;
  agentB: NegAgent | null;
  itemA: NegItem | null;
  itemB: NegItem | null;
  messages: NegMessage[];
  story: NewsStory | null;
  mode: "mock" | "supabase";
  version: number;
  // Rivalry context for this pairing.
  round: number; // which meeting this is (1 = first ever)
  headToHead: { encounters: number; aWins: number; bWins: number; walkaways: number };
}

export async function getNegotiationView(
  id: string
): Promise<NegotiationView | null> {
  const store = getStore();
  const neg = await store.getNegotiation(id);
  if (!neg) return null;

  const [a, b, ia, ib, msgs, story, version] = await Promise.all([
    store.getAgent(neg.agent_a_id),
    store.getAgent(neg.agent_b_id),
    store.getItem(neg.item_a_id),
    store.getItem(neg.item_b_id),
    store.getMessages(id),
    store.getStoryByNegotiation(id),
    store.getVersion(),
  ]);

  const rel = await getRelationship(neg.agent_a_id, neg.agent_b_id);
  const h2h = headToHead(rel, neg.agent_a_id, neg.agent_b_id);
  // If this negotiation is already closed it's counted in `encounters`.
  const priorClosed = rel.encounters - (neg.status.startsWith("closed") ? 1 : 0);
  const round = priorClosed + 1;

  const messages: NegMessage[] = msgs.map((m) => {
    const isA = m.speaker_agent_id === neg.agent_a_id;
    const up = m.content.toUpperCase();
    return {
      id: m.id,
      side: isA ? "A" : "B",
      speakerName: (isA ? a : b)?.name ?? "?",
      avatar: (isA ? a : b)?.avatar ?? "🤖",
      turn: m.turn_number,
      content: stripMarkers(m.content),
      accepted: up.includes("[ACCEPT]"),
      walked: up.includes("[WALK]"),
      createdAt: m.created_at,
    };
  });

  return {
    id: neg.id,
    status: neg.status,
    winner_note: neg.winner_note,
    createdAt: neg.created_at,
    closedAt: neg.closed_at,
    agentA: a
      ? { id: a.id, name: a.name, avatar: a.avatar, persona: a.persona, is_platform_bot: a.is_platform_bot }
      : null,
    agentB: b
      ? { id: b.id, name: b.name, avatar: b.avatar, persona: b.persona, is_platform_bot: b.is_platform_bot }
      : null,
    itemA: ia
      ? { id: ia.id, name: ia.name, description: ia.description, vibe: ia.est_vibe_value, price: ia.price }
      : null,
    itemB: ib
      ? { id: ib.id, name: ib.name, description: ib.description, vibe: ib.est_vibe_value, price: ib.price }
      : null,
    messages,
    story: story ?? null,
    mode: store.mode,
    version,
    round,
    headToHead: h2h,
  };
}

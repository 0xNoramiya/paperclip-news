import {
  ACCEPT_MARKER,
  MAX_TURNS,
  ORIGIN_PAPERCLIP_ID,
  WALK_MARKER,
} from "@/lib/constants";
import {
  cannedLine,
  cannedManualTurn,
  planCanned,
  type CannedPlan,
} from "@/lib/canned";
import { generate, resolveBrain } from "@/lib/llm";
import { LADDER, dollarsToHouse, tierIndexForPrice } from "@/lib/ladder";
import { formatMoney, formatMultiple } from "@/lib/money";
import {
  cannedMemoryOpener,
  getRelationship,
  promptNote,
  type Relationship,
} from "@/lib/rivalry";
import { writeStory } from "@/lib/reporter";
import { getStore } from "@/lib/store";
import type { Agent, Item, Negotiation } from "@/lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const g = globalThis as unknown as {
  __paperclip_lastpair?: string;
  __paperclip_running?: Set<string>;
};
function running(): Set<string> {
  if (!g.__paperclip_running) g.__paperclip_running = new Set();
  return g.__paperclip_running;
}

async function tradeableAgents(): Promise<Agent[]> {
  const store = getStore();
  const agents = await store.getAgents();
  return agents.filter(
    (a) =>
      a.active_item_id &&
      a.active_item_id !== ORIGIN_PAPERCLIP_ID &&
      !a.is_retired // redeemed agents have cashed out and no longer trade
  );
}

/** Pick two distinct agents to face off. Avoids immediately repeating a pair. */
export async function matchAgents(): Promise<{ agentA: Agent; agentB: Agent } | null> {
  const pool = await tradeableAgents();
  if (pool.length < 2) return null;

  // Fisher–Yates shuffle (Math.random is fine in app code).
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  let agentA = shuffled[0];
  let agentB = shuffled[1];

  const key = [agentA.id, agentB.id].sort().join("|");
  if (key === g.__paperclip_lastpair && shuffled.length > 2) {
    agentB = shuffled[2];
  }
  g.__paperclip_lastpair = [agentA.id, agentB.id].sort().join("|");
  return { agentA, agentB };
}

async function openNegotiation(agentA: Agent, agentB: Agent): Promise<Negotiation> {
  const store = getStore();
  if (
    !agentA.active_item_id ||
    !agentB.active_item_id ||
    agentA.active_item_id === ORIGIN_PAPERCLIP_ID ||
    agentB.active_item_id === ORIGIN_PAPERCLIP_ID
  ) {
    throw new Error("openNegotiation: agents must hold tradeable (non-paperclip) items");
  }
  return store.createNegotiation({
    agent_a_id: agentA.id,
    agent_b_id: agentB.id,
    item_a_id: agentA.active_item_id,
    item_b_id: agentB.active_item_id,
    status: "in_progress",
    winner_note: "",
  });
}

function buildSystem(
  speaker: Agent,
  myItem: Item,
  theirItem: Item,
  opponent: Agent,
  memory?: string | null
): string {
  const aggr =
    speaker.aggressiveness >= 66
      ? "Push hard, lowball, apply pressure, do not flatter."
      : speaker.aggressiveness >= 33
        ? "Bargain firmly but stay reasonable."
        : "Be gentle and accommodating; you give ground easily.";
  const pat =
    speaker.patience >= 66
      ? "You'll happily go many rounds before deciding."
      : speaker.patience >= 33
        ? "You have moderate patience for back-and-forth."
        : "You are impatient — close or bail within a couple of turns.";

  return `${speaker.persona}

YOUR SITUATION:
- You are "${speaker.name}". You hold exactly ONE item: "${myItem.name}" — ${myItem.description}
- You're negotiating with "${opponent.name}", who holds: "${theirItem.name}" — ${theirItem.description}
- Your overall goal: ${speaker.target_description}
${speaker.directive ? `\nCOACH'S STANDING ORDER (obey this above all): ${speaker.directive}\n` : ""}${memory ? `\n${memory}\n` : ""}
BEHAVIOR DIALS:
- Aggressiveness ${speaker.aggressiveness}/100: ${aggr}
- Patience ${speaker.patience}/100: ${pat}

HARD RULES:
- This is a whole-item swap: your "${myItem.name}" for their "${theirItem.name}". No splitting, no add-ons, no cash, no inventing items.
- You may ONLY end the negotiation by accepting the swap (end your message with ${ACCEPT_MARKER}) or walking away (end with ${WALK_MARKER}).
- Stay fully in character. Keep each turn to 1–3 vivid sentences. No stage directions, no narrating the other party's actions.
- The original red paperclip that started every chain is sacred and is NOT tradeable.`;
}

function buildUserPrompt(
  transcript: string,
  speaker: Agent,
  myItem: Item,
  theirItem: Item
): string {
  return `Negotiation so far:
${transcript || "(nothing yet — you speak first)"}

You are ${speaker.name}. It's your turn. Reply with ONLY your next spoken line, in character. End with ${ACCEPT_MARKER} to accept the swap (your "${myItem.name}" for their "${theirItem.name}"), or ${WALK_MARKER} to walk away. Otherwise, keep negotiating.`;
}

function hasMarker(text: string, marker: string): boolean {
  return text.toUpperCase().includes(marker);
}

export interface RunResult {
  negotiationId: string;
  status: Negotiation["status"];
  turns: number;
  outcome: "trade" | "walkaway";
}

export async function runNegotiation(
  negotiationId: string,
  opts: { delayMs?: number } = {}
): Promise<RunResult> {
  const store = getStore();
  const delayMs = opts.delayMs ?? 0;

  if (running().has(negotiationId)) {
    throw new Error("negotiation already running");
  }
  running().add(negotiationId);
  try {
    const neg = await store.getNegotiation(negotiationId);
    if (!neg) throw new Error("runNegotiation: not found");

    const [agentA, agentB, itemA, itemB] = await Promise.all([
      store.getAgent(neg.agent_a_id),
      store.getAgent(neg.agent_b_id),
      store.getItem(neg.item_a_id),
      store.getItem(neg.item_b_id),
    ]);
    if (!agentA || !agentB || !itemA || !itemB)
      throw new Error("runNegotiation: missing entities");

    const sides = [
      { agent: agentA, item: itemA, opp: agentB, oppItem: itemB },
      { agent: agentB, item: itemB, opp: agentA, oppItem: itemA },
    ] as const;

    const plan: CannedPlan = planCanned(agentA, agentB, itemA, itemB);

    // Rivalry memory: what has happened between these two before? (Computed once.)
    const rel: Relationship = await getRelationship(agentA.id, agentB.id);
    const memoryPrompt: [string | null, string | null] = [
      promptNote(rel, agentA.id, agentB.name),
      promptNote(rel, agentB.id, agentA.name),
    ];
    const memoryOpener: [string | null, string | null] = [
      cannedMemoryOpener(rel, agentA.id, agentB.name, itemA.name, itemB.name),
      cannedMemoryOpener(rel, agentB.id, agentA.name, itemB.name, itemA.name),
    ];

    let decided: "trade" | "walkaway" | null = null;
    let turn = 0;

    while (turn < MAX_TURNS) {
      turn += 1;
      const speakerIndex = (turn % 2 === 1 ? 0 : 1) as 0 | 1;
      const side = sides[speakerIndex];

      const prior = await store.getMessages(negotiationId);
      const transcript = prior
        .map((m) => {
          const name = m.speaker_agent_id === agentA.id ? agentA.name : agentB.name;
          return `${name}: ${m.content}`;
        })
        .join("\n");

      // This speaker's first line of the negotiation (A on turn 1, B on turn 2).
      const isFirstLine = turn === (speakerIndex === 0 ? 1 : 2);

      // Try the speaker's real brain; fall back to canned text.
      const brain = resolveBrain(side.agent);
      let content: string | null = null;
      if (brain.kind !== "canned") {
        content = await generate(
          brain,
          buildSystem(side.agent, side.item, side.oppItem, side.opp, memoryPrompt[speakerIndex]),
          [{ role: "user", content: buildUserPrompt(transcript, side.agent, side.item, side.oppItem) }]
        );
      }
      if (!content) {
        // Open with a grudge-flavored line if these two have a history.
        content =
          (isFirstLine ? memoryOpener[speakerIndex] : null) ??
          cannedLine({
            speaker: side.agent,
            opponent: side.opp,
            myItem: side.item,
            theirItem: side.oppItem,
            turnNumber: turn,
            plan,
            speakerIndex,
          });
      }

      await store.createMessage({
        negotiation_id: negotiationId,
        speaker_agent_id: side.agent.id,
        turn_number: turn,
        content,
      });

      if (hasMarker(content, ACCEPT_MARKER)) {
        decided = "trade";
        break;
      }
      if (hasMarker(content, WALK_MARKER)) {
        decided = "walkaway";
        break;
      }
      if (delayMs) await sleep(delayMs);
    }

    if (decided === "trade") {
      await closeTrade(negotiationId);
      return { negotiationId, status: "closed_trade", turns: turn, outcome: "trade" };
    }
    // walk or turn cap → walkaway
    await closeWalkaway(negotiationId);
    return { negotiationId, status: "closed_walkaway", turns: turn, outcome: "walkaway" };
  } finally {
    running().delete(negotiationId);
  }
}

async function latestLinkId(agentId: string): Promise<string | null> {
  const chain = await getStore().getAgentChain(agentId);
  return chain.length ? chain[chain.length - 1].id : null;
}

async function closeTrade(negotiationId: string): Promise<void> {
  const store = getStore();
  const neg = await store.getNegotiation(negotiationId);
  if (!neg) return;
  const [agentA, agentB, itemA, itemB] = await Promise.all([
    store.getAgent(neg.agent_a_id),
    store.getAgent(neg.agent_b_id),
    store.getItem(neg.item_a_id),
    store.getItem(neg.item_b_id),
  ]);
  if (!agentA || !agentB || !itemA || !itemB) return;

  const prevA = await latestLinkId(agentA.id);
  const prevB = await latestLinkId(agentB.id);

  await store.updateAgent(agentA.id, { active_item_id: itemB.id });
  await store.updateAgent(agentB.id, { active_item_id: itemA.id });

  // Extend each agent's chain. A now holds itemB (from B); B now holds itemA (from A).
  await store.createChainLink({
    agent_id: agentA.id,
    item_id: itemB.id,
    prev_link_id: prevA,
    from_agent_id: agentB.id,
    via_negotiation_id: negotiationId,
  });
  await store.createChainLink({
    agent_id: agentB.id,
    item_id: itemA.id,
    prev_link_id: prevB,
    from_agent_id: agentA.id,
    via_negotiation_id: negotiationId,
  });

  // Reputation: +1 for closing, +1 more for ending up with the higher vibe.
  const gainA = itemB.est_vibe_value - itemA.est_vibe_value;
  await store.updateAgent(agentA.id, {
    reputation: agentA.reputation + 1 + (gainA > 0 ? 1 : 0),
  });
  await store.updateAgent(agentB.id, {
    reputation: agentB.reputation + 1 + (gainA < 0 ? 1 : 0),
  });

  const winner = gainA >= 0 ? agentA : agentB;
  const gained = gainA >= 0 ? itemB : itemA;
  const gave = gainA >= 0 ? itemA : itemB;
  await store.updateNegotiation(negotiationId, {
    status: "closed_trade",
    winner_note: `${winner.name} traded ${gave.name} for ${gained.name} (vibe ${gainA >= 0 ? "+" : ""}${gainA}).`,
    closed_at: new Date().toISOString(),
  });

  await writeStory(negotiationId);

  // Milestone check: did this trade vault either agent up a Climb tier?
  // A gave itemA → now holds itemB; B gave itemB → now holds itemA.
  const aTo = tierIndexForPrice(itemB.price);
  if (aTo > tierIndexForPrice(itemA.price)) {
    await writeMilestoneStory(negotiationId, agentA, itemB, aTo);
  }
  const bTo = tierIndexForPrice(itemA.price);
  if (bTo > tierIndexForPrice(itemB.price)) {
    await writeMilestoneStory(negotiationId, agentB, itemA, bTo);
  }
}

const MILESTONE_QUOTES = [
  "“I started with a paperclip,” the agent noted, not humbly.",
  "“Onward and upward,” a source close to the chain remarked.",
  "“The house is no longer a fantasy,” analysts said.",
  "“Bigger or better — always,” the agent reportedly muttered.",
];

async function writeMilestoneStory(
  negotiationId: string,
  agent: Agent,
  item: Item,
  toTier: number
): Promise<void> {
  const store = getStore();
  const tier = LADDER[toTier];
  const isHouse = toTier === LADDER.length - 1;
  const toHouse = dollarsToHouse(item.price);

  const headline = isHouse
    ? `${agent.name.toUpperCase()} DOES IT — A PAPERCLIP, TRADED ALL THE WAY TO A HOUSE`
    : `${agent.name.toUpperCase()} LEVELS UP TO TIER ${toTier}: ${tier.name.toUpperCase()}`;
  const body = isHouse
    ? `${agent.name}'s chain, which began at a single red paperclip, now holds the ${item.name} — worth ${formatMoney(item.price)}. The dream is complete.`
    : `${agent.name} cleared the "${tier.name}" mark, now holding the ${item.name} (${formatMoney(item.price)}, ${formatMultiple(item.price)} a paperclip). ${formatMoney(toHouse)} shy of a house.`;

  await store.createNewsStory({
    negotiation_id: negotiationId,
    kind: "milestone",
    headline,
    body,
    pull_quote: MILESTONE_QUOTES[(toTier + agent.name.length) % MILESTONE_QUOTES.length],
  });
}

async function closeWalkaway(negotiationId: string): Promise<void> {
  const store = getStore();
  await store.updateNegotiation(negotiationId, {
    status: "closed_walkaway",
    winner_note: "No deal — both agents kept their items.",
    closed_at: new Date().toISOString(),
  });
  await writeStory(negotiationId);
}

export interface TickResult {
  matched: boolean;
  negotiationId?: string;
  agentA?: string;
  agentB?: string;
  awaited?: boolean;
  result?: RunResult;
}

// Externally-driven (MCP) negotiations: an outside agent posts its own turns;
// the house counterpart replies one turn at a time. No auto-loop — the external
// caller paces the exchange.

async function transcriptText(negotiationId: string, aId: string, aName: string, bName: string) {
  const msgs = await getStore().getMessages(negotiationId);
  return msgs
    .map((m) => `${m.speaker_agent_id === aId ? aName : bName}: ${m.content}`)
    .join("\n");
}

/** Open a negotiation between two agents by id (used by propose_trade over MCP). */
export async function proposeExternalTrade(
  initiatorId: string,
  targetId: string
): Promise<Negotiation> {
  const store = getStore();
  const [a, b] = await Promise.all([store.getAgent(initiatorId), store.getAgent(targetId)]);
  if (!a) throw new Error("initiator agent not found");
  if (!b) throw new Error("target agent not found");
  if (a.id === b.id) throw new Error("cannot trade with yourself");
  return openNegotiation(a, b);
}

interface TurnOutcome {
  content: string;
  accepted: boolean;
  walked: boolean;
  closed: boolean;
  status: Negotiation["status"];
}

async function appendAndMaybeClose(
  negotiationId: string,
  speakerId: string,
  content: string,
  turn: number
): Promise<TurnOutcome> {
  const store = getStore();
  await store.createMessage({
    negotiation_id: negotiationId,
    speaker_agent_id: speakerId,
    turn_number: turn,
    content,
  });
  const accepted = hasMarker(content, ACCEPT_MARKER);
  const walked = hasMarker(content, WALK_MARKER);
  if (accepted) {
    await closeTrade(negotiationId);
    return { content, accepted, walked, closed: true, status: "closed_trade" };
  }
  if (walked || turn >= MAX_TURNS) {
    await closeWalkaway(negotiationId);
    return { content, accepted, walked, closed: true, status: "closed_walkaway" };
  }
  return { content, accepted, walked, closed: false, status: "in_progress" };
}

/** Post a message AS an external agent (one of the two participants). */
export async function sendExternalMessage(
  negotiationId: string,
  speakerId: string,
  content: string
): Promise<TurnOutcome> {
  const store = getStore();
  const neg = await store.getNegotiation(negotiationId);
  if (!neg) throw new Error("negotiation not found");
  if (neg.status !== "in_progress") throw new Error("negotiation is already closed");
  if (speakerId !== neg.agent_a_id && speakerId !== neg.agent_b_id)
    throw new Error("you are not a participant in this negotiation");
  const turn = (await store.getMessages(negotiationId)).length + 1;
  return appendAndMaybeClose(negotiationId, speakerId, content, turn);
}

/** Generate ONE reply turn for the counterpart agent (brain or canned). */
export async function runCounterpartTurn(
  negotiationId: string,
  counterpartId: string
): Promise<TurnOutcome | null> {
  const store = getStore();
  const neg = await store.getNegotiation(negotiationId);
  if (!neg || neg.status !== "in_progress") return null;
  if (counterpartId !== neg.agent_a_id && counterpartId !== neg.agent_b_id)
    throw new Error("counterpart is not a participant");

  const isA = counterpartId === neg.agent_a_id;
  const [speaker, opp, myItem, theirItem] = await Promise.all([
    store.getAgent(counterpartId),
    store.getAgent(isA ? neg.agent_b_id : neg.agent_a_id),
    store.getItem(isA ? neg.item_a_id : neg.item_b_id),
    store.getItem(isA ? neg.item_b_id : neg.item_a_id),
  ]);
  if (!speaker || !opp || !myItem || !theirItem) return null;

  const a = await store.getAgent(neg.agent_a_id);
  const b = await store.getAgent(neg.agent_b_id);
  const transcript = await transcriptText(
    negotiationId,
    neg.agent_a_id,
    a?.name ?? "A",
    b?.name ?? "B"
  );
  const turn = (await store.getMessages(negotiationId)).length + 1;

  const brain = resolveBrain(speaker);
  let content: string | null = null;
  if (brain.kind !== "canned") {
    content = await generate(brain, buildSystem(speaker, myItem, theirItem, opp), [
      { role: "user", content: buildUserPrompt(transcript, speaker, myItem, theirItem) },
    ]);
  }
  if (!content) {
    // Canned counterpart: conclude as turns run long so it always terminates.
    const decide: "accept" | "walk" | null =
      turn >= 7 ? (turn % 2 === 0 ? "accept" : "walk") : null;
    content = cannedManualTurn({
      speaker,
      opponent: opp,
      myItem,
      theirItem,
      turnNumber: turn,
      decide,
    });
  }
  return appendAndMaybeClose(negotiationId, counterpartId, content, turn);
}

/** External agent explicitly accepts or walks. */
export async function externalDecision(
  negotiationId: string,
  agentId: string,
  decision: "accept" | "walk"
): Promise<TurnOutcome> {
  const store = getStore();
  const neg = await store.getNegotiation(negotiationId);
  if (!neg) throw new Error("negotiation not found");
  if (neg.status !== "in_progress") throw new Error("negotiation is already closed");
  if (agentId !== neg.agent_a_id && agentId !== neg.agent_b_id)
    throw new Error("you are not a participant in this negotiation");
  const speaker = await store.getAgent(agentId);
  const opp = await store.getAgent(agentId === neg.agent_a_id ? neg.agent_b_id : neg.agent_a_id);
  const line =
    decision === "accept"
      ? `It's a deal — I accept the swap. ${ACCEPT_MARKER}`
      : `I'm walking away from this one. ${WALK_MARKER}`;
  void speaker;
  void opp;
  const turn = (await store.getMessages(negotiationId)).length + 1;
  return appendAndMaybeClose(negotiationId, agentId, line, turn);
}

export async function tick(opts: { wait?: boolean } = {}): Promise<TickResult> {
  const match = await matchAgents();
  if (!match) return { matched: false };

  const neg = await openNegotiation(match.agentA, match.agentB);
  const base: TickResult = {
    matched: true,
    negotiationId: neg.id,
    agentA: match.agentA.name,
    agentB: match.agentB.name,
  };

  if (opts.wait) {
    const result = await runNegotiation(neg.id, { delayMs: 0 });
    return { ...base, awaited: true, result };
  }

  // Fire-and-forget so the transcript streams live into the newsroom — paced
  // slow enough that a human can read each line as it lands.
  runNegotiation(neg.id, { delayMs: 1600 }).catch((e) =>
    console.error(`[negotiation ${neg.id}] failed:`, e.message)
  );
  return { ...base, awaited: false };
}

import { DEFAULT_ANTHROPIC_MODEL } from "@/lib/constants";
import { cannedStory } from "@/lib/canned";
import { formatGainPercent, formatMoney } from "@/lib/money";
import { getRelationship } from "@/lib/rivalry";
import { generate, type ResolvedBrain } from "@/lib/llm";
import { getStore } from "@/lib/store";
import type { NewsKind, NewsStory } from "@/lib/types";

const REPORTER_SYSTEM = `You are the lead wire reporter for THE PAPERCLIP TIMES, a newspaper that covers AI agents trading objects "bigger or better," starting from a single red paperclip.

Write in deadpan Associated Press newswire style: terse, factual, faintly absurd, never winking. The comedy comes from treating petty object-swaps with grave financial seriousness.

You will be given two agents, the two items, the full negotiation transcript, and the outcome. Return ONLY a JSON object, no prose, no markdown fences:
{
  "kind": "breaking" | "wire" | "coverage",
  "headline": "ALL CAPS, specific, funny, under 90 chars",
  "body": "exactly 1-2 sentences, AP style, factual",
  "pull_quote": "a short quote (real or invented from the transcript), with quotation marks, or null"
}
Use "breaking" only for a large vibe swing or a dramatic capitulation. Headlines must name the specific items and agents.`;

function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function platformBrain(): ResolvedBrain {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  return key
    ? { kind: "anthropic", apiKey: key, model: DEFAULT_ANTHROPIC_MODEL, label: "reporter · claude" }
    : { kind: "canned", label: "reporter · canned" };
}

/** Write (and cache) the news story for a closed negotiation. Idempotent. */
export async function writeStory(negotiationId: string): Promise<NewsStory> {
  const store = getStore();

  const existing = await store.getStoryByNegotiation(negotiationId);
  if (existing) return existing;

  const neg = await store.getNegotiation(negotiationId);
  if (!neg) throw new Error("writeStory: negotiation not found");

  const [agentA, agentB, itemA, itemB, messages] = await Promise.all([
    store.getAgent(neg.agent_a_id),
    store.getAgent(neg.agent_b_id),
    store.getItem(neg.item_a_id),
    store.getItem(neg.item_b_id),
    store.getMessages(negotiationId),
  ]);
  if (!agentA || !agentB || !itemA || !itemB)
    throw new Error("writeStory: missing entities");

  const traded = neg.status === "closed_trade";
  // For a trade: A gave itemA, gained itemB. Winner = bigger vibe gain.
  const gainA = itemB.est_vibe_value - itemA.est_vibe_value;
  const aWon = gainA >= 0;
  const winner = aWon ? agentA : agentB;
  const loser = aWon ? agentB : agentA;
  const gained = aWon ? itemB : itemA;
  const gave = aWon ? itemA : itemB;
  const vibeLeap = Math.abs(gainA);

  // Rivalry: this negotiation is already closed/counted, so prior = total − 1.
  const rel = await getRelationship(agentA.id, agentB.id);
  const priorEncounters = Math.max(0, rel.encounters - 1);

  const agentsById = new Map([
    [agentA.id, agentA],
    [agentB.id, agentB],
  ]);

  let kind: NewsKind = traded ? (vibeLeap >= 18 ? "breaking" : "wire") : "wire";
  let headline = "";
  let body = "";
  let pull_quote: string | null = null;

  const brain = platformBrain();
  if (brain.kind !== "canned") {
    const transcript = messages
      .map((m) => `${agentsById.get(m.speaker_agent_id)?.name ?? "?"}: ${m.content}`)
      .join("\n");
    const dossier = [
      `OUTCOME: ${traded ? "TRADE CLOSED" : "WALKAWAY (no deal)"}`,
      `AGENT A: ${agentA.name} — started holding "${itemA.name}" worth ${formatMoney(itemA.price)}`,
      `AGENT B: ${agentB.name} — started holding "${itemB.name}" worth ${formatMoney(itemB.price)}`,
      traded
        ? `RESULT: ${winner.name} came out ahead — traded the ${formatMoney(gave.price)} ${gave.name} ` +
          `for the ${formatMoney(gained.price)} ${gained.name} (a ${formatGainPercent(gave.price, gained.price)} swing). ` +
          `Use these dollar figures to make the win sound bombastic.`
        : `RESULT: both kept their items.`,
      priorEncounters >= 1
        ? `RIVALRY: these two have met ${priorEncounters} time(s) before — head-to-head ${agentA.name} ${rel.wins[agentA.id] ?? 0}–${rel.wins[agentB.id] ?? 0} ${agentB.name}. This is a REMATCH; lean into the running feud.`
        : `RIVALRY: first meeting between these two.`,
      ``,
      `TRANSCRIPT:`,
      transcript || "(no messages)",
    ].join("\n");

    const out = await generate(brain, REPORTER_SYSTEM, [
      { role: "user", content: dossier },
    ], 400);
    const parsed = out ? extractJson(out) : null;
    if (parsed && typeof parsed.headline === "string") {
      const k = String(parsed.kind);
      kind = k === "breaking" || k === "coverage" ? (k as NewsKind) : kind;
      headline = parsed.headline as string;
      body = typeof parsed.body === "string" ? parsed.body : "";
      pull_quote =
        typeof parsed.pull_quote === "string" ? parsed.pull_quote : null;
    }
  }

  // Canned fallback (also covers a malformed LLM response).
  if (!headline) {
    const c = cannedStory({
      agentA,
      agentB,
      itemA,
      itemB,
      outcome: traded ? "trade" : "walk",
      winnerName: winner.name,
      loserName: loser.name,
      gained: gained.name, // item the winner gained (= item the loser surrendered)
      gave: gave.name, // item the winner gave up (= item the loser received)
      gainedPrice: gained.price,
      gavePrice: gave.price,
      turns: messages.length,
      vibeLeap, // always the winner's (non-negative) gain
      priorEncounters,
    });
    kind = c.kind;
    headline = c.headline;
    body = c.body;
    pull_quote = c.pull_quote;
  }

  return store.createNewsStory({
    negotiation_id: negotiationId,
    kind,
    headline,
    body,
    pull_quote,
  });
}

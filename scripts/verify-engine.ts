/**
 * Standalone engine check (no web server needed). Runs negotiations against a
 * fresh in-memory store and prints transcripts, swaps, chain growth, and the
 * news stories. Run: npx tsx scripts/verify-engine.ts
 */
import { tick } from "@/lib/negotiation";
import { getStore } from "@/lib/store";

async function snapshot(label: string) {
  const store = getStore();
  const [agents, items, negs, news, links] = await Promise.all([
    store.getAgents(),
    store.getItems(),
    store.getNegotiations(),
    store.getNewsStories(20),
    store.getAllChainLinks(),
  ]);
  const itemName = (id: string | null) =>
    id ? items.find((i) => i.id === id)?.name ?? "?" : "—";
  console.log(`\n──────── ${label} ────────`);
  console.log("Holdings:");
  for (const a of agents)
    console.log(`  ${a.avatar} ${a.name.padEnd(22)} holds ${itemName(a.active_item_id)}  (chain links: ${links.filter((l) => l.agent_id === a.id).length}, rep ${a.reputation})`);
  console.log(`Negotiations: ${negs.length} | Chain links: ${links.length} | News: ${news.length}`);
}

async function main() {
  const store = getStore();
  await snapshot("BEFORE");

  for (let i = 0; i < 3; i++) {
    const r = await tick({ wait: true });
    if (!r.matched) {
      console.log("no match");
      continue;
    }
    console.log(`\n>>> TICK ${i + 1}: ${r.agentA} vs ${r.agentB} → ${r.result?.outcome} in ${r.result?.turns} turns`);
    const msgs = await store.getMessages(r.negotiationId!);
    const agents = await store.getAgents();
    const nameOf = (id: string) => agents.find((a) => a.id === id)?.name ?? "?";
    for (const m of msgs)
      console.log(`    ${nameOf(m.speaker_agent_id)}: ${m.content}`);
    const story = await store.getStoryByNegotiation(r.negotiationId!);
    console.log(`    📰 [${story?.kind}] ${story?.headline}`);
    console.log(`       ${story?.body}`);
    if (story?.pull_quote) console.log(`       ${story.pull_quote}`);
  }

  await snapshot("AFTER");

  const negs = await store.getNegotiations();
  const links = await store.getAllChainLinks();
  const news = await store.getNewsStories(50);
  const closed = negs.filter((n) => n.status.startsWith("closed"));
  const trades = negs.filter((n) => n.status === "closed_trade");
  const ok =
    negs.length >= 3 &&
    closed.length === negs.length &&
    news.length >= negs.length && // ≥1 story per negotiation; trades may add a milestone
    links.length >= 6 + trades.length * 2; // 6 seed links + 2 per trade

  console.log(
    `\n${ok ? "✅ PASS" : "❌ FAIL"}: negotiations=${negs.length} closed=${closed.length} trades=${trades.length} news=${news.length} chainLinks=${links.length}`
  );
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

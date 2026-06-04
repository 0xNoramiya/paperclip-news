/**
 * Example "bring your own agent" — connects to the paperclip.news MCP server
 * over stdio and plays one full negotiation against a house agent.
 *
 * Prereq: the web app must be running (npm run dev) so the MCP server has a
 * backend to talk to.
 *
 * Run:  npm run external-agent
 *
 * Flow: provision an agent (get a token) → connect via MCP → list offers →
 * propose a trade → haggle a few turns → accept → read the resulting headline.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const BASE = process.env.PAPERCLIP_URL?.replace(/\/$/, "") || "http://localhost:3000";

function log(...a: unknown[]) {
  console.log("[external-agent]", ...a);
}

async function main() {
  // Provision over REST to get a token (the same thing the "Deploy an Agent" page does).
  log(`provisioning an agent on ${BASE} …`);
  const provisionRes = await fetch(`${BASE}/api/agents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mode: "custom",
      name: "Outsider Ada (External)",
      persona:
        "A sharp, friendly outsider who connected from her own code. She finds the angle and closes warmly.",
      aggressiveness: 65,
      patience: 45,
      target_description: "Anything strange and story-worthy to build a chain with.",
      starter: { kind: "custom", name: "Hand-Crank Flashlight", price: 16 },
    }),
  });
  const provision = await provisionRes.json();
  if (!provisionRes.ok) throw new Error(`provision failed: ${provision.error}`);
  const token: string = provision.agent.token;
  log(`got agent "${provision.agent.name}" with token ${token}`);
  log(`it starts holding: ${provision.startingItem.name}`);

  // The MCP server is spawned as a subprocess over stdio.
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "mcp/server.ts"],
    env: { ...process.env, PAPERCLIP_URL: BASE } as Record<string, string>,
  });
  const client = new Client({ name: "outsider-ada", version: "1.0.0" });
  await client.connect(transport);
  log("connected to MCP server. Tools:", (await client.listTools()).tools.map((t) => t.name).join(", "));

  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const res = (await client.callTool({ name, arguments: args })) as {
      content: { type: string; text: string }[];
      isError?: boolean;
    };
    const text = res.content?.[0]?.text ?? "{}";
    if (res.isError) throw new Error(text);
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  };

  const { offers } = await call("list_offers");
  const target = offers.find(
    (o: { is_platform_bot: boolean; name: string }) =>
      o.is_platform_bot && o.name !== provision.agent.name
  );
  if (!target) throw new Error("no house agent available to trade with");
  log(`targeting ${target.name}, who holds ${target.item?.name} (vibe ${target.item?.vibe})`);

  const proposal = await call("propose_trade", {
    agent_token: token,
    target_agent_id: target.agent_id,
  });
  const negId: string = proposal.negotiation_id;
  log(`opened negotiation ${negId}: my ${proposal.your_item?.name} ⇄ their ${proposal.their_item?.name}`);

  // Scripted lines so the example needs no API key; a real BYO agent would generate these with its own LLM.
  const lines = [
    `Hello ${target.name}! Straight up: my ${proposal.your_item?.name} for your ${proposal.their_item?.name}. I think we both win.`,
    `I hear you. Here's my honest pitch — your ${proposal.their_item?.name} fits my collection perfectly, and you get something genuinely useful in return.`,
    `Last sweetener: I'll throw in my undying gratitude and a glowing reference. Deal?`,
  ];
  let outcome: { status?: string; story?: { kind: string; headline: string; body: string } } | null = null;
  for (const line of lines) {
    log(`  Ada → ${line}`);
    const turn = await call("send_message", {
      agent_token: token,
      negotiation_id: negId,
      content: line,
    });
    if (turn.reply) log(`  ${turn.reply.from} → ${turn.reply.content}`);
    if (turn.closed) {
      // The counterpart accepted or walked — the deal is already settled.
      outcome = { status: turn.status, story: turn.story };
      log(`negotiation closed mid-exchange (${turn.status}).`);
      break;
    }
  }

  // Only try to accept if the negotiation is still open.
  if (!outcome) {
    const result = await call("accept", { agent_token: token, negotiation_id: negId });
    outcome = { status: result.status, story: result.story };
    log(`accepted → status: ${result.status}`);
  }
  if (outcome?.story) {
    log(`📰 [${outcome.story.kind}] ${outcome.story.headline}`);
    log(`   ${outcome.story.body}`);
  }

  const { stories } = await call("get_news", { limit: 3 });
  log("latest newsroom headlines:");
  for (const s of stories) log(`   • [${s.kind}] ${s.headline}`);

  log("done — open the newsroom to see it on the wire.");
  await client.close();
  process.exit(0);
}

main().catch((e) => {
  console.error("[external-agent] failed:", e.message);
  process.exit(1);
});

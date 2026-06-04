/**
 * paperclip.news MCP server.
 *
 * Exposes the trading floor as MCP tools so an EXTERNAL agent can connect and
 * play — list offers, check its state, propose a trade, negotiate turn-by-turn,
 * and accept/walk. Authentication is per-agent via the agent's token.
 *
 * It is a thin client over the running Next app's REST API (so it shares the
 * exact same store/state the website shows). Point it at the app with:
 *   PAPERCLIP_URL=http://localhost:3000  (default)
 *
 * Run:  npm run mcp        (stdio transport)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = process.env.PAPERCLIP_URL?.replace(/\/$/, "") || "http://localhost:3000";

async function api(action: string, payload: Record<string, unknown> = {}) {
  const res = await fetch(`${BASE}/api/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({ error: "non-JSON response" }));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function fail(e: unknown) {
  return {
    content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }],
    isError: true,
  };
}

const server = new McpServer({
  name: "paperclip-news",
  version: "1.0.0",
});

server.registerTool(
  "list_offers",
  {
    description:
      "List every agent currently on the trading floor, the single item each holds, and its vibe value. Use this to find a counterpart to trade with.",
    inputSchema: {},
  },
  async () => {
    try {
      return ok(await api("offers"));
    } catch (e) {
      return fail(e);
    }
  }
);

server.registerTool(
  "get_my_state",
  {
    description:
      "Get your own agent: the item you currently hold, your persona/dials, reputation, and your chain back to the paperclip. Requires your agent_token.",
    inputSchema: { agent_token: z.string().describe("Your secret per-agent token") },
  },
  async ({ agent_token }) => {
    try {
      return ok(await api("state", { agent_token }));
    } catch (e) {
      return fail(e);
    }
  }
);

server.registerTool(
  "propose_trade",
  {
    description:
      "Open a negotiation with another agent (your single item for theirs). Returns a negotiation_id and the counterpart's item. Then use send_message to haggle.",
    inputSchema: {
      agent_token: z.string(),
      target_agent_id: z.string().describe("agent_id of the agent you want to trade with"),
    },
  },
  async ({ agent_token, target_agent_id }) => {
    try {
      return ok(await api("propose", { agent_token, target_agent_id }));
    } catch (e) {
      return fail(e);
    }
  }
);

server.registerTool(
  "send_message",
  {
    description:
      "Post one negotiating line as your agent. The counterpart replies in the same call (its reply is returned). Keep haggling, then accept or walk_away.",
    inputSchema: {
      agent_token: z.string(),
      negotiation_id: z.string(),
      content: z.string().describe("Your in-character negotiating line (1-3 sentences)"),
    },
  },
  async ({ agent_token, negotiation_id, content }) => {
    try {
      return ok(await api("message", { agent_token, negotiation_id, content }));
    } catch (e) {
      return fail(e);
    }
  }
);

server.registerTool(
  "accept",
  {
    description:
      "Accept the standing swap (your item for theirs). Closes the deal, swaps the items, extends both chains, and triggers the newsroom story.",
    inputSchema: { agent_token: z.string(), negotiation_id: z.string() },
  },
  async ({ agent_token, negotiation_id }) => {
    try {
      return ok(await api("accept", { agent_token, negotiation_id }));
    } catch (e) {
      return fail(e);
    }
  }
);

server.registerTool(
  "walk_away",
  {
    description: "Walk away from the negotiation with no deal. Both keep their items.",
    inputSchema: { agent_token: z.string(), negotiation_id: z.string() },
  },
  async ({ agent_token, negotiation_id }) => {
    try {
      return ok(await api("walk", { agent_token, negotiation_id }));
    } catch (e) {
      return fail(e);
    }
  }
);

server.registerTool(
  "get_news",
  {
    description: "Recent headlines from THE PAPERCLIP TIMES newsroom.",
    inputSchema: { limit: z.number().int().min(1).max(50).optional() },
  },
  async ({ limit }) => {
    try {
      return ok(await api("news", { limit: limit ?? 10 }));
    } catch (e) {
      return fail(e);
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // IMPORTANT: log to stderr only — stdout is the MCP protocol channel.
  console.error(`[paperclip-mcp] connected (stdio). Backend: ${BASE}`);
}

main().catch((e) => {
  console.error("[paperclip-mcp] fatal:", e);
  process.exit(1);
});

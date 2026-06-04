import { NextResponse } from "next/server";
import { z } from "zod";
import { createCustomAgent, deployTemplateAgent } from "@/lib/create-agent";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const StarterSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("paperclip") }),
  z.object({
    kind: z.literal("custom"),
    name: z.string().min(1),
    price: z.number().min(0.01).max(1_000_000_000),
    description: z.string().optional(),
  }),
]);

const CustomSchema = z.object({
  mode: z.literal("custom"),
  name: z.string().min(1),
  persona: z.string().min(1),
  aggressiveness: z.number().min(0).max(100),
  patience: z.number().min(0).max(100),
  target_description: z.string().min(1),
  avatar: z.string().optional(),
  starter: StarterSchema.optional(),
});

const DeploySchema = z.object({
  mode: z.literal("deploy"),
  templateId: z.enum(["aggressive", "moderate", "chill"]),
  name: z.string().optional(),
  provider: z.enum(["anthropic", "openai"]),
  apiKey: z.string().min(8),
  model: z.string().optional(),
  starter: StarterSchema.optional(),
});

const Body = z.discriminatedUnion("mode", [CustomSchema, DeploySchema]);

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { agent, item } =
      parsed.data.mode === "custom"
        ? await createCustomAgent(parsed.data)
        : await deployTemplateAgent(parsed.data);

    // Return the token so the creator can also drive this agent over MCP.
    return NextResponse.json({
      ok: true,
      agent: {
        id: agent.id,
        name: agent.name,
        avatar: agent.avatar,
        token: agent.token,
        llm_provider: agent.llm_provider,
      },
      startingItem: { name: item.name, vibe: item.est_vibe_value, price: item.price },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

// Lightweight roster for clients that want it (the browse page renders server-side).
export async function GET() {
  const store = getStore();
  const [agents, items] = await Promise.all([store.getAgents(), store.getItems()]);
  const itemsById = new Map(items.map((i) => [i.id, i]));
  return NextResponse.json({
    agents: agents.map((a) => {
      const it = a.active_item_id ? itemsById.get(a.active_item_id) : null;
      return {
        id: a.id,
        name: a.name,
        avatar: a.avatar,
        is_platform_bot: a.is_platform_bot,
        is_retired: a.is_retired,
        llm_provider: a.llm_provider,
        reputation: a.reputation,
        holds: it ? { name: it.name, price: it.price } : null,
      };
    }),
  });
}

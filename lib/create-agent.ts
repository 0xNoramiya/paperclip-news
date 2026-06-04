import { randomUUID } from "crypto";
import {
  ORIGIN_PAPERCLIP_NAME,
  PAPERCLIP_PRICE,
} from "@/lib/constants";
import { setByoKey } from "@/lib/byo-keys";
import { getTemplate } from "@/lib/agent-templates";
import { pickStarter } from "@/lib/starter-items";
import { getStore } from "@/lib/store";
import type { Agent, Item } from "@/lib/types";

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));
const newToken = () => "pk_" + randomUUID().replace(/-/g, "").slice(0, 16);

// Map a dollar price to a fuzzy 1-100 vibe (used for breaking/leap detection).
function vibeFromPrice(price: number): number {
  return Math.max(1, Math.min(100, Math.round(Math.log10(price + 1) * 25)));
}

// What an agent starts holding: the classic paperclip, or its own goods.
export type StarterSpec =
  | { kind: "paperclip" }
  | { kind: "custom"; name: string; price: number; description?: string };

interface ResolvedStarter {
  name: string;
  description: string;
  vibe: number;
  price: number;
}

function resolveStarter(spec: StarterSpec | undefined, seedName: string): ResolvedStarter {
  if (!spec || spec.kind === "paperclip") {
    return {
      name: ORIGIN_PAPERCLIP_NAME,
      description:
        "One humble red paperclip — worth a single cent. The purest way to begin the climb.",
      vibe: 1,
      price: PAPERCLIP_PRICE,
    };
  }
  const price = Math.max(0.01, Math.min(1_000_000_000, Number(spec.price) || 0.01));
  return {
    name: spec.name.trim().slice(0, 80) || pickStarter(seedName).name,
    description: spec.description?.trim().slice(0, 300) || "A good of the deployer's own choosing.",
    vibe: vibeFromPrice(price),
    price,
  };
}

async function materialize(
  agentFields: Omit<Agent, "id" | "created_at" | "active_item_id">,
  starter: ResolvedStarter
): Promise<{ agent: Agent; item: Item }> {
  const store = getStore();
  const item = await store.createItem({
    name: starter.name,
    description: starter.description,
    photo_url: null,
    est_vibe_value: clamp(starter.vibe, 1, 100),
    price: starter.price,
    created_by: null,
  });
  const agent = await store.createAgent({
    ...agentFields,
    active_item_id: item.id,
  });
  await store.createChainLink({
    agent_id: agent.id,
    item_id: item.id,
    prev_link_id: null, // sits directly on the paperclip — link zero
    from_agent_id: null,
    via_negotiation_id: null,
  });
  return { agent, item };
}

export interface CustomInput {
  name: string;
  persona: string;
  aggressiveness: number;
  patience: number;
  target_description: string;
  avatar?: string;
  starter?: StarterSpec;
}

export async function createCustomAgent(input: CustomInput) {
  return materialize(
    {
      user_id: null,
      name: input.name.trim().slice(0, 60) || "Unnamed Agent",
      persona: input.persona.trim().slice(0, 2000),
      aggressiveness: clamp(input.aggressiveness),
      patience: clamp(input.patience),
      target_description: input.target_description.trim().slice(0, 600),
      directive: "",
      reputation: 0,
      is_platform_bot: false,
      is_retired: false,
      token: newToken(),
      llm_provider: "platform",
      llm_model: null,
      avatar: (input.avatar || "🧠").slice(0, 4),
    },
    resolveStarter(input.starter, input.name)
  );
}

export interface DeployInput {
  templateId: string;
  name?: string;
  provider: "anthropic" | "openai";
  apiKey: string;
  model?: string;
  starter?: StarterSpec;
}

export async function deployTemplateAgent(input: DeployInput) {
  const tpl = getTemplate(input.templateId);
  if (!tpl) throw new Error("unknown template");
  if (!input.apiKey?.trim()) throw new Error("apiKey required");

  const { agent, item } = await materialize(
    {
      user_id: null,
      name: (input.name?.trim() || tpl.name).slice(0, 60),
      persona: tpl.persona,
      aggressiveness: tpl.aggressiveness,
      patience: tpl.patience,
      target_description: tpl.target_description,
      directive: "",
      reputation: 0,
      is_platform_bot: false,
      is_retired: false,
      token: newToken(),
      llm_provider: input.provider,
      llm_model: input.model?.trim() || null,
      avatar: tpl.avatar,
    },
    resolveStarter(input.starter, input.name || tpl.name)
  );

  // Key lives only in server memory — never persisted or returned.
  setByoKey(agent.id, {
    provider: input.provider,
    apiKey: input.apiKey.trim(),
    model: input.model?.trim() || undefined,
  });

  return { agent, item };
}

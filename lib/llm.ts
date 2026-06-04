import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import {
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_OPENAI_MODEL,
  LLM_TIMEOUT_MS,
} from "@/lib/constants";
import { getByoKey } from "@/lib/byo-keys";
import type { Agent } from "@/lib/types";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ResolvedBrain {
  kind: "anthropic" | "openai" | "canned";
  apiKey?: string;
  model?: string;
  label: string; // for logs / UI ("platform · claude", "byo · openai")
}

/**
 * Decide which brain drives an agent on this turn:
 *  - platform bots → server ANTHROPIC_API_KEY (or canned if missing)
 *  - BYO agents    → their in-memory key (or platform key, or canned)
 */
export function resolveBrain(agent: Agent): ResolvedBrain {
  const platformKey = process.env.ANTHROPIC_API_KEY?.trim();

  if (agent.llm_provider === "anthropic" || agent.llm_provider === "openai") {
    const byo = getByoKey(agent.id);
    if (byo) {
      return {
        kind: byo.provider,
        apiKey: byo.apiKey,
        model:
          byo.model ??
          (byo.provider === "openai"
            ? DEFAULT_OPENAI_MODEL
            : DEFAULT_ANTHROPIC_MODEL),
        label: `byo · ${byo.provider}`,
      };
    }
    // BYO key not present (e.g. after a restart) — degrade gracefully.
    if (platformKey) {
      return {
        kind: "anthropic",
        apiKey: platformKey,
        model: DEFAULT_ANTHROPIC_MODEL,
        label: "platform-fallback · claude",
      };
    }
    return { kind: "canned", label: "canned" };
  }

  if (platformKey) {
    return {
      kind: "anthropic",
      apiKey: platformKey,
      model: agent.llm_model ?? DEFAULT_ANTHROPIC_MODEL,
      label: "platform · claude",
    };
  }
  return { kind: "canned", label: "canned" };
}

function withTimeout<T>(p: Promise<T>, ms = LLM_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("llm-timeout")), ms)
    ),
  ]);
}

async function callAnthropic(
  brain: ResolvedBrain,
  system: string,
  messages: ChatMessage[],
  maxTokens: number
): Promise<string> {
  const client = new Anthropic({ apiKey: brain.apiKey! });
  const res = await withTimeout(
    client.messages.create({
      model: brain.model ?? DEFAULT_ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })
  );
  return res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}

async function callOpenAI(
  brain: ResolvedBrain,
  system: string,
  messages: ChatMessage[],
  maxTokens: number
): Promise<string> {
  const client = new OpenAI({ apiKey: brain.apiKey! });
  const res = await withTimeout(
    client.chat.completions.create({
      model: brain.model ?? DEFAULT_OPENAI_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    })
  );
  return (res.choices[0]?.message?.content ?? "").trim();
}

/**
 * Run one model completion. Returns the text, or null if the brain is canned
 * or the call fails (callers fall back to canned text).
 */
export async function generate(
  brain: ResolvedBrain,
  system: string,
  messages: ChatMessage[],
  maxTokens = 320
): Promise<string | null> {
  if (brain.kind === "canned") return null;
  try {
    if (brain.kind === "openai")
      return await callOpenAI(brain, system, messages, maxTokens);
    return await callAnthropic(brain, system, messages, maxTokens);
  } catch (err) {
    console.warn(
      `[llm] ${brain.label} call failed (${(err as Error).message}) — falling back to canned`
    );
    return null;
  }
}

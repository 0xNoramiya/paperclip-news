import type { LlmProvider } from "@/lib/types";

// Bring-your-own-key secrets live ONLY in server process memory — never written
// to the database or returned to any client. A deployed BYO agent's key is set
// here when it's deployed and read here when it negotiates. (Trade-off: a server
// restart drops the keys, after which BYO agents fall back to canned/platform.)
export interface ByoBrain {
  provider: Exclude<LlmProvider, "platform" | "canned">; // 'anthropic' | 'openai'
  apiKey: string;
  model?: string;
}

const g = globalThis as unknown as { __paperclip_byo?: Map<string, ByoBrain> };
function map() {
  if (!g.__paperclip_byo) g.__paperclip_byo = new Map();
  return g.__paperclip_byo;
}

export function setByoKey(agentId: string, brain: ByoBrain) {
  map().set(agentId, brain);
}
export function getByoKey(agentId: string): ByoBrain | undefined {
  return map().get(agentId);
}
export function hasByoKey(agentId: string): boolean {
  return map().has(agentId);
}

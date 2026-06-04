import { randomUUID } from "crypto";

// A live record of agent-to-agent / MCP activity. Real external agents (the
// example script, Claude Code, any MCP client) write here via /api/mcp; the
// "guest agent" demo writes here too. Surfaced as the A2A WIRE on the newsroom.
export type A2AKind =
  | "connect"
  | "offers"
  | "state"
  | "propose"
  | "message"
  | "accept"
  | "walk";

export interface A2AEvent {
  id: string;
  at: string;
  kind: A2AKind;
  icon: string;
  agentName: string;
  text: string;
  negotiationId: string | null;
}

interface A2AStore {
  events: A2AEvent[];
  version: number;
  presence: Map<string, { name: string; avatar: string; at: string }>;
}

const ICONS: Record<A2AKind, string> = {
  connect: "🔌",
  offers: "👀",
  state: "🧭",
  propose: "🤝",
  message: "💬",
  accept: "✅",
  walk: "🚪",
};

const MAX_EVENTS = 40;
const PRESENCE_WINDOW_MS = 5 * 60 * 1000;

const g = globalThis as unknown as { __paperclip_a2a?: A2AStore };
function store(): A2AStore {
  if (!g.__paperclip_a2a)
    g.__paperclip_a2a = { events: [], version: 0, presence: new Map() };
  return g.__paperclip_a2a;
}

export function recordA2A(e: {
  kind: A2AKind;
  agentName: string;
  text: string;
  negotiationId?: string | null;
}) {
  const s = store();
  s.events.unshift({
    id: randomUUID(),
    at: new Date().toISOString(),
    kind: e.kind,
    icon: ICONS[e.kind],
    agentName: e.agentName,
    text: e.text,
    negotiationId: e.negotiationId ?? null,
  });
  if (s.events.length > MAX_EVENTS) s.events.length = MAX_EVENTS;
  s.version += 1;
}

export function markPresence(agentId: string, name: string, avatar: string) {
  store().presence.set(agentId, { name, avatar, at: new Date().toISOString() });
}

export function getA2A(limit = 8): A2AEvent[] {
  return store().events.slice(0, limit);
}

export interface A2APresence {
  agentId: string;
  name: string;
  avatar: string;
  at: string;
}
export function getPresence(nowMs = Date.now()): A2APresence[] {
  const out: A2APresence[] = [];
  for (const [agentId, p] of store().presence) {
    if (nowMs - new Date(p.at).getTime() <= PRESENCE_WINDOW_MS)
      out.push({ agentId, name: p.name, avatar: p.avatar, at: p.at });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export function isLiveViaMcp(agentId: string, nowMs = Date.now()): boolean {
  const p = store().presence.get(agentId);
  return !!p && nowMs - new Date(p.at).getTime() <= PRESENCE_WINDOW_MS;
}

export function getA2AVersion(): number {
  return store().version;
}

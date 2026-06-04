import { randomUUID } from "crypto";
import { buildSeed } from "@/lib/seed-data";
import type {
  Agent,
  ChainLink,
  Follow,
  Item,
  Negotiation,
  NegotiationMessage,
  NewsStory,
  User,
} from "@/lib/types";
import type { AgentPatch, NegotiationPatch, Store } from "./types";

interface Tables {
  users: Map<string, User>;
  agents: Map<string, Agent>;
  items: Map<string, Item>;
  chainLinks: Map<string, ChainLink>;
  negotiations: Map<string, Negotiation>;
  messages: Map<string, NegotiationMessage>;
  news: Map<string, NewsStory>;
  follows: Map<string, Follow>;
  version: number;
}

// Survive Next.js dev HMR + share one store across all API routes in the process.
const g = globalThis as unknown as { __paperclip_db?: Tables };

function freshTables(): Tables {
  const t: Tables = {
    users: new Map(),
    agents: new Map(),
    items: new Map(),
    chainLinks: new Map(),
    negotiations: new Map(),
    messages: new Map(),
    news: new Map(),
    follows: new Map(),
    version: 1,
  };
  const seed = buildSeed();
  seed.users.forEach((u) => t.users.set(u.id, u));
  seed.items.forEach((i) => t.items.set(i.id, i));
  seed.agents.forEach((a) => t.agents.set(a.id, a));
  seed.chainLinks.forEach((c) => t.chainLinks.set(c.id, c));
  return t;
}

function tables(): Tables {
  if (!g.__paperclip_db) g.__paperclip_db = freshTables();
  return g.__paperclip_db;
}

const now = () => new Date().toISOString();

export class MemoryStore implements Store {
  readonly mode = "mock" as const;

  private t() {
    return tables();
  }
  private bump() {
    this.t().version += 1;
  }

  async createUser(handle: string): Promise<User> {
    const existing = await this.getUserByHandle(handle);
    if (existing) return existing;
    const u: User = { id: randomUUID(), handle, created_at: now() };
    this.t().users.set(u.id, u);
    this.bump();
    return u;
  }
  async getUser(id: string) {
    return this.t().users.get(id) ?? null;
  }
  async getUserByHandle(handle: string) {
    return [...this.t().users.values()].find((u) => u.handle === handle) ?? null;
  }

  async getAgents() {
    return [...this.t().agents.values()].sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );
  }
  async getAgent(id: string) {
    return this.t().agents.get(id) ?? null;
  }
  async getAgentByToken(token: string) {
    return (
      [...this.t().agents.values()].find((a) => a.token === token) ?? null
    );
  }
  async createAgent(a: Omit<Agent, "id" | "created_at"> & { id?: string }) {
    const agent: Agent = { ...a, id: a.id ?? randomUUID(), created_at: now() };
    this.t().agents.set(agent.id, agent);
    this.bump();
    return agent;
  }
  async updateAgent(id: string, patch: AgentPatch) {
    const a = this.t().agents.get(id);
    if (!a) return null;
    const next = { ...a, ...patch };
    this.t().agents.set(id, next);
    this.bump();
    return next;
  }

  async getItems() {
    return [...this.t().items.values()];
  }
  async getItem(id: string) {
    return this.t().items.get(id) ?? null;
  }
  async createItem(i: Omit<Item, "id" | "created_at"> & { id?: string }) {
    const item: Item = { ...i, id: i.id ?? randomUUID(), created_at: now() };
    this.t().items.set(item.id, item);
    this.bump();
    return item;
  }

  async createChainLink(
    c: Omit<ChainLink, "id" | "acquired_at"> & {
      id?: string;
      acquired_at?: string;
    }
  ) {
    const link: ChainLink = {
      ...c,
      id: c.id ?? randomUUID(),
      acquired_at: c.acquired_at ?? now(),
    };
    this.t().chainLinks.set(link.id, link);
    this.bump();
    return link;
  }
  async getChainLink(id: string) {
    return this.t().chainLinks.get(id) ?? null;
  }
  async getAgentChain(agentId: string) {
    return [...this.t().chainLinks.values()]
      .filter((c) => c.agent_id === agentId)
      .sort((a, b) => a.acquired_at.localeCompare(b.acquired_at));
  }
  async getAllChainLinks() {
    return [...this.t().chainLinks.values()];
  }

  async createNegotiation(
    n: Omit<Negotiation, "id" | "created_at" | "closed_at"> & { id?: string }
  ) {
    const neg: Negotiation = {
      ...n,
      id: n.id ?? randomUUID(),
      created_at: now(),
      closed_at: null,
    };
    this.t().negotiations.set(neg.id, neg);
    this.bump();
    return neg;
  }
  async getNegotiation(id: string) {
    return this.t().negotiations.get(id) ?? null;
  }
  async getNegotiations() {
    return [...this.t().negotiations.values()].sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
  }
  async updateNegotiation(id: string, patch: NegotiationPatch) {
    const n = this.t().negotiations.get(id);
    if (!n) return null;
    const next = { ...n, ...patch };
    this.t().negotiations.set(id, next);
    this.bump();
    return next;
  }

  async createMessage(
    m: Omit<NegotiationMessage, "id" | "created_at"> & { id?: string }
  ) {
    const msg: NegotiationMessage = {
      ...m,
      id: m.id ?? randomUUID(),
      created_at: now(),
    };
    this.t().messages.set(msg.id, msg);
    this.bump();
    return msg;
  }
  async getMessages(negotiationId: string) {
    return [...this.t().messages.values()]
      .filter((m) => m.negotiation_id === negotiationId)
      .sort((a, b) => a.turn_number - b.turn_number);
  }

  async createNewsStory(
    s: Omit<NewsStory, "id" | "created_at"> & { id?: string }
  ) {
    const story: NewsStory = {
      ...s,
      id: s.id ?? randomUUID(),
      created_at: now(),
    };
    this.t().news.set(story.id, story);
    this.bump();
    return story;
  }
  async getNewsStories(limit = 50) {
    return [...this.t().news.values()]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }
  async getStoryByNegotiation(negotiationId: string) {
    return (
      [...this.t().news.values()].find(
        (s) => s.negotiation_id === negotiationId
      ) ?? null
    );
  }

  async createFollow(userId: string, agentId: string) {
    const existing = [...this.t().follows.values()].find(
      (f) => f.user_id === userId && f.agent_id === agentId
    );
    if (existing) return existing;
    const f: Follow = {
      id: randomUUID(),
      user_id: userId,
      agent_id: agentId,
      created_at: now(),
    };
    this.t().follows.set(f.id, f);
    this.bump();
    return f;
  }
  async deleteFollow(userId: string, agentId: string) {
    for (const [id, f] of this.t().follows) {
      if (f.user_id === userId && f.agent_id === agentId)
        this.t().follows.delete(id);
    }
    this.bump();
  }
  async getFollows(userId: string) {
    return [...this.t().follows.values()].filter((f) => f.user_id === userId);
  }

  async getVersion() {
    return this.t().version;
  }
}

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

// Patch helpers — partial updates that never touch id/created_at.
export type AgentPatch = Partial<
  Pick<
    Agent,
    | "name"
    | "persona"
    | "aggressiveness"
    | "patience"
    | "target_description"
    | "directive"
    | "active_item_id"
    | "reputation"
    | "is_retired"
    | "llm_provider"
    | "llm_model"
    | "avatar"
  >
>;

export type NegotiationPatch = Partial<
  Pick<Negotiation, "status" | "winner_note" | "closed_at">
>;

// Everything async so the in-memory and Supabase stores are interchangeable.
export interface Store {
  /** "mock" (in-memory) or "supabase". */
  readonly mode: "mock" | "supabase";

  createUser(handle: string): Promise<User>;
  getUser(id: string): Promise<User | null>;
  getUserByHandle(handle: string): Promise<User | null>;

  getAgents(): Promise<Agent[]>;
  getAgent(id: string): Promise<Agent | null>;
  getAgentByToken(token: string): Promise<Agent | null>;
  createAgent(
    a: Omit<Agent, "id" | "created_at"> & { id?: string }
  ): Promise<Agent>;
  updateAgent(id: string, patch: AgentPatch): Promise<Agent | null>;

  getItems(): Promise<Item[]>;
  getItem(id: string): Promise<Item | null>;
  createItem(
    i: Omit<Item, "id" | "created_at"> & { id?: string }
  ): Promise<Item>;

  createChainLink(
    c: Omit<ChainLink, "id" | "acquired_at"> & {
      id?: string;
      acquired_at?: string;
    }
  ): Promise<ChainLink>;
  getChainLink(id: string): Promise<ChainLink | null>;
  /** All links for an agent, oldest → newest. */
  getAgentChain(agentId: string): Promise<ChainLink[]>;
  getAllChainLinks(): Promise<ChainLink[]>;

  createNegotiation(
    n: Omit<Negotiation, "id" | "created_at" | "closed_at"> & {
      id?: string;
    }
  ): Promise<Negotiation>;
  getNegotiation(id: string): Promise<Negotiation | null>;
  getNegotiations(): Promise<Negotiation[]>;
  updateNegotiation(
    id: string,
    patch: NegotiationPatch
  ): Promise<Negotiation | null>;

  createMessage(
    m: Omit<NegotiationMessage, "id" | "created_at"> & { id?: string }
  ): Promise<NegotiationMessage>;
  getMessages(negotiationId: string): Promise<NegotiationMessage[]>;

  createNewsStory(
    s: Omit<NewsStory, "id" | "created_at"> & { id?: string }
  ): Promise<NewsStory>;
  getNewsStories(limit?: number): Promise<NewsStory[]>;
  getStoryByNegotiation(negotiationId: string): Promise<NewsStory | null>;

  createFollow(userId: string, agentId: string): Promise<Follow>;
  deleteFollow(userId: string, agentId: string): Promise<void>;
  getFollows(userId: string): Promise<Follow[]>;

  /** Monotonic version, bumped on every mutation — drives mock-mode polling. */
  getVersion(): Promise<number>;
}

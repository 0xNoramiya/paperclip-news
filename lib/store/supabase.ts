import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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

// Server-side client using the service role key (full access, bypasses RLS).
// Only ever instantiated in API routes / server modules.
function client(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(`supabase: ${res.error.message}`);
  return res.data as T;
}

export class SupabaseStore implements Store {
  readonly mode = "supabase" as const;
  private db = client();

  async createUser(handle: string): Promise<User> {
    const found = await this.getUserByHandle(handle);
    if (found) return found;
    return unwrap(
      await this.db.from("users").insert({ handle }).select().single()
    );
  }
  async getUser(id: string) {
    const { data } = await this.db.from("users").select().eq("id", id).maybeSingle();
    return (data as User) ?? null;
  }
  async getUserByHandle(handle: string) {
    const { data } = await this.db
      .from("users")
      .select()
      .eq("handle", handle)
      .maybeSingle();
    return (data as User) ?? null;
  }

  async getAgents() {
    return unwrap<Agent[]>(
      await this.db.from("agents").select().order("created_at")
    );
  }
  async getAgent(id: string) {
    const { data } = await this.db.from("agents").select().eq("id", id).maybeSingle();
    return (data as Agent) ?? null;
  }
  async getAgentByToken(token: string) {
    const { data } = await this.db
      .from("agents")
      .select()
      .eq("token", token)
      .maybeSingle();
    return (data as Agent) ?? null;
  }
  async createAgent(a: Omit<Agent, "id" | "created_at"> & { id?: string }) {
    return unwrap<Agent>(
      await this.db.from("agents").insert(a).select().single()
    );
  }
  async updateAgent(id: string, patch: AgentPatch) {
    const { data } = await this.db
      .from("agents")
      .update(patch)
      .eq("id", id)
      .select()
      .maybeSingle();
    return (data as Agent) ?? null;
  }

  async getItems() {
    return unwrap<Item[]>(await this.db.from("items").select());
  }
  async getItem(id: string) {
    const { data } = await this.db.from("items").select().eq("id", id).maybeSingle();
    return (data as Item) ?? null;
  }
  async createItem(i: Omit<Item, "id" | "created_at"> & { id?: string }) {
    return unwrap<Item>(await this.db.from("items").insert(i).select().single());
  }

  async createChainLink(
    c: Omit<ChainLink, "id" | "acquired_at"> & { id?: string; acquired_at?: string }
  ) {
    return unwrap<ChainLink>(
      await this.db.from("chain_links").insert(c).select().single()
    );
  }
  async getChainLink(id: string) {
    const { data } = await this.db
      .from("chain_links")
      .select()
      .eq("id", id)
      .maybeSingle();
    return (data as ChainLink) ?? null;
  }
  async getAgentChain(agentId: string) {
    return unwrap<ChainLink[]>(
      await this.db
        .from("chain_links")
        .select()
        .eq("agent_id", agentId)
        .order("acquired_at")
    );
  }
  async getAllChainLinks() {
    return unwrap<ChainLink[]>(await this.db.from("chain_links").select());
  }

  async createNegotiation(
    n: Omit<Negotiation, "id" | "created_at" | "closed_at"> & { id?: string }
  ) {
    return unwrap<Negotiation>(
      await this.db.from("negotiations").insert(n).select().single()
    );
  }
  async getNegotiation(id: string) {
    const { data } = await this.db
      .from("negotiations")
      .select()
      .eq("id", id)
      .maybeSingle();
    return (data as Negotiation) ?? null;
  }
  async getNegotiations() {
    return unwrap<Negotiation[]>(
      await this.db.from("negotiations").select().order("created_at", { ascending: false })
    );
  }
  async updateNegotiation(id: string, patch: NegotiationPatch) {
    const { data } = await this.db
      .from("negotiations")
      .update(patch)
      .eq("id", id)
      .select()
      .maybeSingle();
    return (data as Negotiation) ?? null;
  }

  async createMessage(
    m: Omit<NegotiationMessage, "id" | "created_at"> & { id?: string }
  ) {
    return unwrap<NegotiationMessage>(
      await this.db.from("negotiation_messages").insert(m).select().single()
    );
  }
  async getMessages(negotiationId: string) {
    return unwrap<NegotiationMessage[]>(
      await this.db
        .from("negotiation_messages")
        .select()
        .eq("negotiation_id", negotiationId)
        .order("turn_number")
    );
  }

  async createNewsStory(
    s: Omit<NewsStory, "id" | "created_at"> & { id?: string }
  ) {
    return unwrap<NewsStory>(
      await this.db.from("news_stories").insert(s).select().single()
    );
  }
  async getNewsStories(limit = 50) {
    return unwrap<NewsStory[]>(
      await this.db
        .from("news_stories")
        .select()
        .order("created_at", { ascending: false })
        .limit(limit)
    );
  }
  async getStoryByNegotiation(negotiationId: string) {
    const { data } = await this.db
      .from("news_stories")
      .select()
      .eq("negotiation_id", negotiationId)
      .maybeSingle();
    return (data as NewsStory) ?? null;
  }

  async createFollow(userId: string, agentId: string) {
    return unwrap<Follow>(
      await this.db
        .from("follows")
        .upsert(
          { user_id: userId, agent_id: agentId },
          { onConflict: "user_id,agent_id" }
        )
        .select()
        .single()
    );
  }
  async deleteFollow(userId: string, agentId: string) {
    await this.db
      .from("follows")
      .delete()
      .eq("user_id", userId)
      .eq("agent_id", agentId);
  }
  async getFollows(userId: string) {
    return unwrap<Follow[]>(
      await this.db.from("follows").select().eq("user_id", userId)
    );
  }

  // Realtime drives the UI in supabase mode; this is only a polling fallback.
  async getVersion() {
    const counts = await Promise.all([
      this.db.from("news_stories").select("id", { count: "exact", head: true }),
      this.db.from("negotiation_messages").select("id", { count: "exact", head: true }),
      this.db.from("negotiations").select("id", { count: "exact", head: true }),
    ]);
    return counts.reduce((sum, c) => sum + (c.count ?? 0), 0);
  }
}

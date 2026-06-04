// Row shapes mirror the Postgres columns (snake_case) so the Supabase store
// needs zero mapping — `select *` returns exactly these shapes.

export type NegotiationStatus =
  | "open"
  | "in_progress"
  | "closed_trade"
  | "closed_walkaway";

export type NewsKind = "breaking" | "wire" | "coverage" | "milestone" | "opinion";

export type LlmProvider = "anthropic" | "openai" | "platform" | "canned";

export interface User {
  id: string;
  handle: string;
  created_at: string;
}

export interface Agent {
  id: string;
  user_id: string | null;
  name: string;
  persona: string;
  aggressiveness: number; // 0-100
  patience: number; // 0-100
  target_description: string;
  directive: string; // the coach's live standing order (steers negotiations)
  active_item_id: string | null;
  reputation: number;
  is_platform_bot: boolean;
  is_retired: boolean; // redeemed/cashed out — no longer trades
  created_at: string;

  // Agent-to-agent / bring-your-own-key wiring (extension columns).
  token: string; // per-agent secret used by the MCP server
  llm_provider: LlmProvider; // which brain drives this agent
  llm_model: string | null; // optional model override
  avatar: string; // emoji/glyph for the newsroom
}

export interface Item {
  id: string;
  name: string;
  description: string;
  photo_url: string | null;
  est_vibe_value: number; // fuzzy 1-100, flavor only — never a fairness gate
  price: number; // dollar value (paperclip = $0.01) — flavor for bombastic wins
  created_by: string | null;
  created_at: string;
}

export interface ChainLink {
  id: string;
  agent_id: string;
  item_id: string;
  prev_link_id: string | null; // null = sits directly on the paperclip (link zero)
  acquired_at: string;

  // Extension columns enriching provenance ("who it came from").
  from_agent_id: string | null; // the counterparty this item was traded from
  via_negotiation_id: string | null;
}

export interface Negotiation {
  id: string;
  agent_a_id: string;
  agent_b_id: string;
  item_a_id: string;
  item_b_id: string;
  status: NegotiationStatus;
  winner_note: string;
  created_at: string;
  closed_at: string | null;
}

export interface NegotiationMessage {
  id: string;
  negotiation_id: string;
  speaker_agent_id: string;
  turn_number: number;
  content: string;
  created_at: string;
}

export interface NewsStory {
  id: string;
  negotiation_id: string | null; // null for non-negotiation coverage (e.g. coach memos)
  kind: NewsKind;
  headline: string;
  body: string;
  pull_quote: string | null;
  created_at: string;
}

export interface Follow {
  id: string;
  user_id: string;
  agent_id: string;
  created_at: string;
}

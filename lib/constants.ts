// The symbolic origin every chain traces back to: link zero.
export const ORIGIN_PAPERCLIP_ID = "00000000-0000-4000-8000-000000000001";
export const ORIGIN_PAPERCLIP_NAME = "Red Paperclip";

// Every chain starts from a one-cent paperclip — the baseline for "bombastic"
// return multiples.
export const PAPERCLIP_PRICE = 0.01;

// A stable "house" user that owns the platform bots.
export const PLATFORM_USER_ID = "00000000-0000-4000-8000-0000000000aa";

// Negotiation guardrails.
export const MAX_TURNS = 10;
export const LLM_TIMEOUT_MS = 25_000;

// A vibe jump at or above this is "BREAKING."
export const BREAKING_LEAP = 18;

// Default Anthropic model for platform agents + the reporter.
// Override with ANTHROPIC_MODEL. (Kept configurable so the demo survives
// model deprecations.)
export const DEFAULT_ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-5";

export const DEFAULT_OPENAI_MODEL =
  process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

// Structured end-of-turn markers the agents must emit.
export const ACCEPT_MARKER = "[ACCEPT]";
export const WALK_MARKER = "[WALK]";

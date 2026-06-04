import { MemoryStore } from "./memory";
import { SupabaseStore } from "./supabase";
import type { Store } from "./types";

export type { Store } from "./types";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

const g = globalThis as unknown as {
  __paperclip_store?: Store;
  __paperclip_banner_shown?: boolean;
};

function banner(store: Store) {
  if (g.__paperclip_banner_shown) return;
  g.__paperclip_banner_shown = true;
  if (store.mode === "mock") {
    console.log(
      "\n\x1b[41m\x1b[97m RUNNING IN LOCAL MOCK MODE \x1b[0m " +
        "in-memory seeded store + polling (no Supabase configured)\n"
    );
  } else {
    console.log(
      "\n\x1b[42m\x1b[30m SUPABASE MODE \x1b[0m connected to Postgres + Realtime\n"
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(
      "\x1b[43m\x1b[30m NO ANTHROPIC KEY \x1b[0m agents + reporter will use canned text " +
        "(UI still fully demoable)\n"
    );
  }
}

/** The single source of truth for all server code. */
export function getStore(): Store {
  if (!g.__paperclip_store) {
    g.__paperclip_store = isSupabaseConfigured()
      ? new SupabaseStore()
      : new MemoryStore();
    banner(g.__paperclip_store);
  }
  return g.__paperclip_store;
}

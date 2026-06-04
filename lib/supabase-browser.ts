"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// A browser Supabase client for Realtime subscriptions — only created when the
// public env vars are present. In mock mode this returns null and the UI polls.
let cached: SupabaseClient | null | undefined;

export function browserSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  cached = url && key ? createClient(url, key) : null;
  return cached;
}

/**
 * Seed a real Supabase project with the paperclip origin, house user, and the
 * platform bots. Idempotent (upsert on fixed IDs).
 *
 *   npm run seed
 *
 * In LOCAL MOCK MODE (no Supabase env) the in-memory store seeds itself on
 * boot, so this script just tells you that and exits.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { buildSeed } from "@/lib/seed-data";

function loadEnvLocal() {
  try {
    const txt = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* no .env.local — fine */
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.log(
      "\n⚠️  No Supabase configured — the app runs in LOCAL MOCK MODE and " +
        "seeds an in-memory store automatically on boot. Nothing to do here.\n" +
        "   (Set NEXT_PUBLIC_SUPABASE_URL + a key in .env.local to seed Postgres.)\n"
    );
    return;
  }

  const db = createClient(url, key, { auth: { persistSession: false } });
  const seed = buildSeed();

  console.log("Seeding Supabase…");
  const steps: [string, unknown[]][] = [
    ["users", seed.users],
    ["items", seed.items],
    ["agents", seed.agents],
    ["chain_links", seed.chainLinks],
  ];
  for (const [table, rows] of steps) {
    const { error } = await db
      .from(table)
      .upsert(rows as never, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error(`${table}: ${error.message}`);
    console.log(`  ✓ ${table}: ${rows.length}`);
  }
  console.log("Done.\n");
}

main().catch((e) => {
  console.error("Seed failed:", e.message);
  process.exit(1);
});

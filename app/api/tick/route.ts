import { NextRequest, NextResponse } from "next/server";
import { tick } from "@/lib/negotiation";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Run a tick of the world: match two agents and run a negotiation. (The world
 * also ticks itself via the heartbeat; this is the manual/scripted entry point.)
 *   POST /api/tick           → start one negotiation (fire-and-forget, streams live)
 *   POST /api/tick?wait=1     → run one negotiation to completion, return the result
 *   POST /api/tick?n=3        → start three negotiations
 *   GET  /api/tick?wait=1     → same as POST (convenient for curl)
 */
async function handle(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wait = searchParams.get("wait") === "1" || searchParams.get("wait") === "true";
  const n = Math.min(Math.max(parseInt(searchParams.get("n") ?? "1", 10) || 1, 1), 8);

  const ticks = [];
  for (let i = 0; i < n; i++) {
    // When running several at once, await each so they don't fight over matching.
    ticks.push(await tick({ wait: wait || n > 1 }));
  }

  return NextResponse.json({ ok: true, count: ticks.length, ticks });
}

export async function POST(req: NextRequest) {
  return handle(req);
}
export async function GET(req: NextRequest) {
  return handle(req);
}

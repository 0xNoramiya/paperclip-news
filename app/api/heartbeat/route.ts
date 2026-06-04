import { NextResponse } from "next/server";
import { getHeartbeat, setHeartbeat, startHeartbeat } from "@/lib/heartbeat";

export const dynamic = "force-dynamic";

// GET  → current world-heartbeat status (also ensures it's running)
// POST { enabled: boolean } → pause/resume autonomous trading
export async function GET() {
  startHeartbeat();
  return NextResponse.json(getHeartbeat());
}

export async function POST(req: Request) {
  startHeartbeat();
  const { enabled } = await req.json().catch(() => ({ enabled: true }));
  return NextResponse.json(setHeartbeat(Boolean(enabled)));
}

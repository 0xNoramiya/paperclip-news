import { NextResponse } from "next/server";
import { publishEditorial } from "@/lib/editorial";

export const dynamic = "force-dynamic";

// "Summon the columnist" — force-publish an op-ed now (bypasses the throttle).
export async function POST() {
  const story = await publishEditorial(true);
  return NextResponse.json({ ok: true, story });
}

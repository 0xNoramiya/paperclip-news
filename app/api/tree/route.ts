import { NextResponse } from "next/server";
import { buildTree } from "@/lib/tree";

export const dynamic = "force-dynamic";

// Polled by the live trade-tree so it grows as the autonomous world trades.
export async function GET() {
  return NextResponse.json(await buildTree());
}

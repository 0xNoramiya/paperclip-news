import { NextResponse } from "next/server";
import { buildFeed } from "@/lib/newsroom";

export const dynamic = "force-dynamic";

// The newsroom front page polls this in mock mode (and as a Supabase fallback).
export async function GET() {
  const feed = await buildFeed();
  return NextResponse.json(feed);
}

import { NextResponse } from "next/server";
import { buildExchange } from "@/lib/exchange";

export const dynamic = "force-dynamic";

// Polled by the live markets board so ranks shuffle as the world trades.
export async function GET() {
  return NextResponse.json(await buildExchange());
}

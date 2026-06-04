import { NextResponse } from "next/server";
import { getNegotiationView } from "@/lib/negotiation-view";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const view = await getNegotiationView(params.id);
  if (!view) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(view);
}

import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import type { AgentPatch } from "@/lib/store/types";

export const dynamic = "force-dynamic";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// Coach (re-tune) an agent: adjust its dials / goal / directive, then drop a
// "MANAGEMENT MEMO" onto the wire so the intervention shows up live.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const store = getStore();
  const agent = await store.getAgent(params.id);
  if (!agent) return NextResponse.json({ error: "agent not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: AgentPatch = {};
  if (typeof body.aggressiveness === "number") patch.aggressiveness = clamp(body.aggressiveness);
  if (typeof body.patience === "number") patch.patience = clamp(body.patience);
  if (typeof body.target_description === "string")
    patch.target_description = body.target_description.trim().slice(0, 600);
  if (typeof body.persona === "string") patch.persona = body.persona.trim().slice(0, 2000);
  if (typeof body.directive === "string") patch.directive = body.directive.trim().slice(0, 280);

  const updated = await store.updateAgent(params.id, patch);
  if (!updated) return NextResponse.json({ error: "update failed" }, { status: 500 });

  // File the coaching as newsroom coverage.
  const directive = updated.directive?.trim();
  const headline = directive
    ? `MANAGEMENT MEMO: ${updated.name.toUpperCase()}'S COACH ISSUES NEW ORDERS`
    : `MANAGEMENT MEMO: ${updated.name.toUpperCase()} RETUNED BY ITS COACH`;
  const body_text =
    `${updated.name} was retuned by its handler — aggressiveness ${updated.aggressiveness}, ` +
    `patience ${updated.patience}.` +
    (directive ? ` Standing order: “${directive}”.` : "");
  await store.createNewsStory({
    negotiation_id: null,
    kind: "coverage",
    headline,
    body: body_text,
    pull_quote: directive ? `“${directive}”` : "“We're making changes,” the coach said.",
  });

  return NextResponse.json({
    ok: true,
    agent: {
      id: updated.id,
      name: updated.name,
      aggressiveness: updated.aggressiveness,
      patience: updated.patience,
      target_description: updated.target_description,
      directive: updated.directive,
    },
  });
}

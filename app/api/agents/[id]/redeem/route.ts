import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

// Redeem (cash out) an agent's current item: the agent retires and stops
// trading, holding its prize. House agents cannot be redeemed — they trade
// forever.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const store = getStore();
  const agent = await store.getAgent(params.id);
  if (!agent) return NextResponse.json({ error: "agent not found" }, { status: 404 });
  if (agent.is_platform_bot)
    return NextResponse.json(
      { error: "house agents never cash out — they trade forever" },
      { status: 400 }
    );

  const updated = await store.updateAgent(params.id, { is_retired: true });
  const item = updated?.active_item_id ? await store.getItem(updated.active_item_id) : null;
  return NextResponse.json({
    ok: true,
    agent: { id: agent.id, name: agent.name, is_retired: true },
    redeemedItem: item ? { name: item.name, price: item.price } : null,
  });
}

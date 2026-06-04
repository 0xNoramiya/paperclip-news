import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

// Records a follow against a cookie-scoped anonymous user (the `follows` table).
// Called best-effort by the client, which also tracks follows locally.
export async function POST(req: Request) {
  const { agentId, action } = await req.json().catch(() => ({}));
  if (!agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });

  const store = getStore();
  const jar = cookies();
  const existingUid = jar.get("pc_uid")?.value ?? null;
  let user = existingUid ? await store.getUser(existingUid) : null;
  if (!user) {
    user = await store.createUser(`reader-${Math.random().toString(36).slice(2, 8)}`);
  }
  const uid = user.id;

  if (action === "unfollow") await store.deleteFollow(uid, agentId);
  else await store.createFollow(uid, agentId);

  const res = NextResponse.json({ ok: true, following: action !== "unfollow" });
  res.cookies.set("pc_uid", uid, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

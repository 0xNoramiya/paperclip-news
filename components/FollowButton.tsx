"use client";
import { useEffect, useState } from "react";

const KEY = "pc_follows";

export function readFollows(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
function writeFollows(ids: string[]) {
  localStorage.setItem(KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent("paperclip:follows"));
}

// Follows are tracked client-side (localStorage) with a best-effort write to the
// server; the `follows` table backs the authenticated multi-user/Supabase path.
export function FollowButton({
  agentId,
  size = "md",
}: {
  agentId: string;
  size?: "sm" | "md";
}) {
  const [following, setFollowing] = useState(false);
  useEffect(() => {
    setFollowing(readFollows().includes(agentId));
    const sync = () => setFollowing(readFollows().includes(agentId));
    window.addEventListener("paperclip:follows", sync);
    return () => window.removeEventListener("paperclip:follows", sync);
  }, [agentId]);

  function toggle() {
    const cur = readFollows();
    const next = cur.includes(agentId)
      ? cur.filter((id) => id !== agentId)
      : [...cur, agentId];
    writeFollows(next);
    // Best-effort server record (no-op failure in mock/offline).
    fetch("/api/follow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId, action: cur.includes(agentId) ? "unfollow" : "follow" }),
    }).catch(() => {});
    setFollowing(!cur.includes(agentId));
  }

  const pad = size === "sm" ? "px-2.5 py-1 text-[0.6rem]" : "px-3.5 py-1.5 text-xs";
  return (
    <button
      onClick={toggle}
      className={`rounded-sm border-2 font-sans font-bold uppercase tracking-[0.14em] transition ${pad} ${
        following
          ? "border-ink bg-ink text-newsprint hover:bg-ink/80"
          : "border-ink bg-transparent text-ink hover:bg-ink/10"
      }`}
    >
      {following ? "Following ✓" : "Follow chain"}
    </button>
  );
}

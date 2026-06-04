"use client";
import { useState } from "react";
import { Paperclip } from "./Paperclip";

// "Advance the world" — the live-demo button. Starts a negotiation, then nudges
// the newsroom to refetch so the new live coverage appears immediately.
export function AdvanceButton({
  className = "",
  label = "Advance the world",
}: {
  className?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function go() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/tick", { method: "POST" });
      // Let the live coverage start streaming, then ping listeners.
      window.dispatchEvent(new CustomEvent("paperclip:refetch"));
      setTimeout(
        () => window.dispatchEvent(new CustomEvent("paperclip:refetch")),
        900
      );
    } catch {
      /* ignore — newsroom polling will catch up */
    } finally {
      setTimeout(() => setBusy(false), 700);
    }
  }

  return (
    <button
      onClick={go}
      disabled={busy}
      className={`group inline-flex items-center gap-2 rounded-sm border-2 border-paperclipRed bg-paperclipRed px-4 py-2 font-sans text-xs font-bold uppercase tracking-[0.18em] text-newsprint transition hover:bg-paperclipRedDark disabled:opacity-70 ${className}`}
    >
      <Paperclip
        size={16}
        strokeWidth={2.6}
        className={`-rotate-12 ${busy ? "animate-spin" : "group-hover:-rotate-45"} transition-transform`}
      />
      {busy ? "Going to press…" : label}
    </button>
  );
}

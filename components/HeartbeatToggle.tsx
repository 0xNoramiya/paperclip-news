"use client";
import { useEffect, useState } from "react";

// Pause/resume the world heartbeat (autonomous trading).
export function HeartbeatToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    // GET also boots the heartbeat if instrumentation didn't.
    fetch("/api/heartbeat")
      .then((r) => r.json())
      .then((d) => alive && setEnabled(Boolean(d.enabled)))
      .catch(() => alive && setEnabled(true));
    return () => {
      alive = false;
    };
  }, []);

  async function toggle() {
    if (busy || enabled === null) return;
    setBusy(true);
    const next = !enabled;
    setEnabled(next); // optimistic
    try {
      const r = await fetch("/api/heartbeat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const d = await r.json();
      setEnabled(Boolean(d.enabled));
      if (next) window.dispatchEvent(new CustomEvent("paperclip:refetch"));
    } catch {
      setEnabled(!next); // revert
    } finally {
      setBusy(false);
    }
  }

  const on = enabled === true;
  return (
    <button
      onClick={toggle}
      disabled={enabled === null}
      title={
        on
          ? "The world is trading on its own — click to pause"
          : "Autonomous trading paused — click to resume"
      }
      className={`group inline-flex items-center gap-1.5 rounded-sm border-2 px-2.5 py-1.5 font-sans text-[0.6rem] font-bold uppercase tracking-[0.14em] transition ${
        on
          ? "border-ink bg-transparent text-ink hover:bg-ink/10"
          : "border-wireGray/50 bg-transparent text-wireGray hover:border-ink hover:text-ink"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          on ? "animate-livepulse bg-paperclipRed" : "bg-wireGray/60"
        }`}
      />
      <span className="hidden sm:inline">{on ? "Live" : "Paused"}</span>
      <span className="text-[0.7rem] leading-none">{on ? "⏸" : "▶"}</span>
    </button>
  );
}

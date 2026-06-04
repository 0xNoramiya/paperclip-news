"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { climbPercent } from "@/lib/ladder";
import { itemGlyph } from "@/lib/glyph";
import { formatMoney, formatMultiple } from "@/lib/money";

export interface ReplayStep {
  itemName: string;
  itemId: string;
  price: number;
  fromAgentName: string | null;
  headline: string | null;
}

const STEP_MS = 2100;

export function ChainReplay({
  agentName,
  agentAvatar,
  steps,
}: {
  agentName: string;
  agentAvatar: string;
  steps: ReplayStep[];
}) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [displayVal, setDisplayVal] = useState(steps[0]?.price ?? 0);
  const raf = useRef<number | null>(null);

  const last = steps.length - 1;
  const atEnd = i >= last;

  const start = useCallback(() => {
    setI(0);
    setPlaying(true);
    setDisplayVal(steps[0]?.price ?? 0);
    setOpen(true);
  }, [steps]);

  useEffect(() => {
    if (!open || !playing || atEnd) return;
    const t = setTimeout(() => setI((n) => Math.min(last, n + 1)), STEP_MS);
    return () => clearTimeout(t);
  }, [open, playing, atEnd, i, last]);

  // Count-up the value when the step changes.
  useEffect(() => {
    if (!open) return;
    const from = i === 0 ? steps[0]?.price ?? 0 : steps[i - 1].price;
    const to = steps[i]?.price ?? 0;
    const t0 = performance.now();
    const dur = 650;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayVal(from + (to - from) * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [i, open, steps]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (steps.length < 2) return null;

  const step = steps[i];
  const pct = climbPercent(step.price);

  return (
    <>
      <button
        onClick={start}
        className="inline-flex items-center gap-2 rounded-sm border-2 border-paperclipRed px-4 py-2 font-sans text-xs font-bold uppercase tracking-[0.14em] text-paperclipRed transition hover:bg-paperclipRed hover:text-newsprint"
      >
        ▶ Replay the climb
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-lg border-2 border-newsprint bg-newsprint shadow-clip"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-2 border-ink px-4 py-2">
              <span className="flex items-center gap-2 font-sans text-[0.6rem] font-black uppercase tracking-[0.2em] text-paperclipRed">
                {agentAvatar} {agentName} · The Climb, Replayed
              </span>
              <button
                onClick={() => setOpen(false)}
                className="font-sans text-sm font-bold text-wireGray hover:text-ink"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-7 text-center">
              <div className="font-sans text-[0.55rem] font-black uppercase tracking-[0.2em] text-wireGray">
                {i === 0 ? "Started with" : `Trade ${i} of ${last}`}
              </div>
              <div key={i} className="animate-fadeup">
                <div className="mt-2 text-6xl">{itemGlyph(step.itemName, step.itemId)}</div>
                <div className="mt-1 font-masthead text-2xl font-black leading-tight">
                  {step.itemName}
                </div>
              </div>

              <div className="mt-3 font-masthead text-4xl font-black text-paperclipRedDark tabular-nums">
                {formatMoney(displayVal)}
              </div>
              <div className="font-sans text-[0.6rem] font-bold uppercase tracking-widest text-wireGray">
                {formatMultiple(step.price)} a paperclip
              </div>

              <div className="mx-auto mt-4 flex items-center gap-2">
                <span className="text-base">📎</span>
                <div className="h-2.5 flex-1 overflow-hidden border border-ink/30 bg-white/60">
                  <div
                    className="h-full bg-paperclipRed transition-all duration-700 ease-out"
                    style={{ width: `${Math.max(1.5, pct)}%` }}
                  />
                </div>
                <span className="text-base">🏠</span>
              </div>

              <p className="mt-4 min-h-[3.2rem] font-serif text-sm leading-snug text-ink/85">
                {i === 0 ? (
                  <span className="text-wireGray">Every chain begins at a single red paperclip.</span>
                ) : (
                  <>
                    {step.fromAgentName && (
                      <span className="font-sans text-[0.6rem] font-bold uppercase tracking-wide text-wireGray">
                        won from {step.fromAgentName} —{" "}
                      </span>
                    )}
                    <span className="italic">
                      {step.headline ? `“${step.headline}”` : "another deal on the wire."}
                    </span>
                  </>
                )}
              </p>

              {atEnd && (
                <div className="mt-3 border-t-2 border-double border-ink pt-3 font-masthead text-lg font-black">
                  🏁 Now holding {step.itemName} — {formatMultiple(step.price)} a paperclip
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t-2 border-ink px-4 py-2.5">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setI(0);
                    setPlaying(true);
                  }}
                  className="rounded-sm border border-ink px-2 py-1 font-sans text-[0.6rem] font-bold uppercase tracking-wider hover:bg-ink hover:text-newsprint"
                >
                  ⏮ Restart
                </button>
                <button
                  onClick={() => (atEnd ? (setI(0), setPlaying(true)) : setPlaying((p) => !p))}
                  className="rounded-sm border-2 border-ink bg-ink px-3 py-1 font-sans text-[0.6rem] font-bold uppercase tracking-wider text-newsprint hover:bg-ink/80"
                >
                  {atEnd ? "↺ Again" : playing ? "⏸ Pause" : "▶ Play"}
                </button>
              </div>
              <div className="flex items-center gap-1">
                {steps.map((_, k) => (
                  <button
                    key={k}
                    onClick={() => {
                      setI(k);
                      setPlaying(false);
                    }}
                    aria-label={`Step ${k}`}
                    className={`h-2 w-2 rounded-full transition ${
                      k === i ? "bg-paperclipRed" : "bg-ink/25 hover:bg-ink/50"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

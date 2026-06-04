"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// The spectator-as-coach: live-tune an agent's dials, goal, and a standing
// directive. Saving re-tunes the agent and files a "management memo" to the wire.
export function CoachPanel({
  agentId,
  aggressiveness,
  patience,
  target,
  directive,
}: {
  agentId: string;
  aggressiveness: number;
  patience: number;
  target: string;
  directive: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [aggr, setAggr] = useState(aggressiveness);
  const [pat, setPat] = useState(patience);
  const [tgt, setTgt] = useState(target);
  const [dir, setDir] = useState(directive);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await fetch(`/api/agents/${agentId}/coach`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          aggressiveness: aggr,
          patience: pat,
          target_description: tgt,
          directive: dir,
        }),
      });
      window.dispatchEvent(new CustomEvent("paperclip:refetch"));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setOpen(false);
      router.refresh(); // re-render the server page with the new dials
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-2 border-ink">
      <div className="flex items-center justify-between border-b-2 border-ink bg-newsprintDark px-4 py-2.5">
        <span className="font-sans text-[0.62rem] font-black uppercase tracking-[0.2em]">
          🎯 Coach's Desk
        </span>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="rounded-sm border-2 border-ink bg-ink px-3 py-1 font-sans text-[0.6rem] font-bold uppercase tracking-[0.14em] text-newsprint hover:bg-ink/80"
          >
            Coach this agent
          </button>
        )}
      </div>

      <div className="p-5">
        {saved && (
          <div className="mb-3 border-2 border-emerald-700 bg-emerald-700/10 px-3 py-2 font-serif text-sm text-emerald-800">
            ✅ Orders received — it's on the wire. The agent fights differently from its next deal.
          </div>
        )}

        {!open ? (
          <p className="font-serif text-sm">
            {directive ? (
              <>
                Standing order:{" "}
                <span className="font-semibold italic text-paperclipRedDark">“{directive}”</span>
              </>
            ) : (
              <span className="text-wireGray">
                You're the coach. Tune this agent's instincts and give it a standing
                order — it'll fight differently from its very next negotiation.
              </span>
            )}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-5 sm:grid-cols-2">
              <Slider label="Aggressiveness" value={aggr} onChange={setAggr} />
              <Slider label="Patience" value={pat} onChange={setPat} />
            </div>
            <label className="block">
              <span className="mb-1 block font-sans text-[0.62rem] font-bold uppercase tracking-[0.16em] text-wireGray">
                Trading goal
              </span>
              <input
                value={tgt}
                onChange={(e) => setTgt(e.target.value)}
                className="w-full border-2 border-ink/40 bg-white/70 px-3 py-2 font-serif focus:border-ink focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-sans text-[0.62rem] font-bold uppercase tracking-[0.16em] text-wireGray">
                Standing order (directive)
              </span>
              <textarea
                value={dir}
                onChange={(e) => setDir(e.target.value)}
                rows={2}
                placeholder='e.g. "Stop walking away — close generous deals fast." or "Hold out for huge wins only."'
                className="w-full border-2 border-ink/40 bg-white/70 px-3 py-2 font-serif focus:border-ink focus:outline-none"
              />
              <span className="mt-1 block font-sans text-[0.58rem] uppercase tracking-wide text-wireGray">
                Words like “close / deals / generous” make it eager; “hold / walk /
                maximize” make it stubborn.
              </span>
            </label>
            <div className="flex gap-3">
              <button
                onClick={save}
                disabled={busy}
                className="rounded-sm border-2 border-paperclipRed bg-paperclipRed px-4 py-2 font-sans text-xs font-bold uppercase tracking-[0.14em] text-newsprint hover:bg-paperclipRedDark disabled:opacity-60"
              >
                {busy ? "Sending orders…" : "Save & put it on the wire"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-wireGray hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between font-sans text-[0.62rem] font-bold uppercase tracking-[0.16em] text-wireGray">
        <span>{label}</span>
        <span className="text-ink">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-paperclipRed"
      />
    </div>
  );
}

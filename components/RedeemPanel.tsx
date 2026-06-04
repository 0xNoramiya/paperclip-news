"use client";
import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { ClipBullet } from "./Paperclip";

interface CurrentItem {
  name: string;
  price: number;
}

// The "Redemption Desk": the pathway for a deployer to cash out the goods their
// agent has won. House agents never cash out — they trade forever.
export function RedeemPanel({
  agentId,
  agentName,
  isPlatformBot,
  isRetired: initialRetired,
  currentItem,
}: {
  agentId: string;
  agentName: string;
  isPlatformBot: boolean;
  isRetired: boolean;
  currentItem: CurrentItem | null;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retired, setRetired] = useState(initialRetired);
  const [error, setError] = useState<string | null>(null);

  async function redeem() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/redeem`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not redeem");
      setRetired(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const value = currentItem ? formatMoney(currentItem.price) : "—";

  return (
    <section id="redeem" className="scroll-mt-20 border-2 border-ink">
      <div className="flex items-center justify-between border-b-2 border-ink bg-newsprintDark px-4 py-2.5">
        <span className="flex items-center gap-2 font-sans text-[0.62rem] font-black uppercase tracking-[0.2em]">
          <ClipBullet /> Redemption Desk
        </span>
        {retired && (
          <span className="rounded-sm bg-emerald-700 px-2 py-0.5 font-sans text-[0.55rem] font-black uppercase tracking-widest text-white">
            Claimed
          </span>
        )}
      </div>

      <div className="p-5">
        {retired ? (
          <p className="font-serif text-sm">
            ✅ <strong>{agentName}</strong> has cashed out and retired, holding the{" "}
            <strong>{currentItem?.name}</strong> ({value}). The chain is sealed —
            this agent no longer trades. A real fulfillment desk would now arrange
            handoff of the physical good.
          </p>
        ) : isPlatformBot ? (
          <p className="font-serif text-sm text-wireGray">
            🏛️ <strong className="text-ink">{agentName}</strong> is a house agent —
            it never cashes out. House agents trade forever so the floor stays
            lively. Deploy your own agent to play for keeps and redeem its winnings.
          </p>
        ) : (
          <div>
            <p className="font-serif text-sm">
              Your agent currently holds the <strong>{currentItem?.name ?? "—"}</strong>,
              valued at <strong className="text-paperclipRedDark">{value}</strong>.
              You can let it keep trading up — or <em>redeem</em> it now to lock in
              the win.
            </p>

            {!open ? (
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  onClick={() => setOpen(true)}
                  className="rounded-sm border-2 border-paperclipRed bg-paperclipRed px-4 py-2 font-sans text-xs font-bold uppercase tracking-[0.14em] text-newsprint transition hover:bg-paperclipRedDark"
                >
                  Redeem this item →
                </button>
                <span className="self-center font-sans text-[0.6rem] uppercase tracking-wide text-wireGray">
                  or hit “Advance the world” to keep trading up
                </span>
              </div>
            ) : (
              <div className="mt-3 border-2 border-dashed border-ink/40 p-3">
                <p className="mb-2 font-sans text-[0.6rem] font-black uppercase tracking-[0.16em] text-wireGray">
                  How redemption works
                </p>
                <ol className="ml-4 list-decimal space-y-1 font-serif text-sm text-ink/85">
                  <li>Verify ownership — you deployed this agent (you hold its token).</li>
                  <li>We freeze {agentName}'s trading so the prize can't be swapped away.</li>
                  <li>We arrange handoff of the <strong>{currentItem?.name}</strong> ({value}).</li>
                  <li>The good ships to you — the chain that started at a $0.01 paperclip ends in your hands.</li>
                </ol>
                {error && (
                  <p className="mt-2 font-serif text-sm text-paperclipRedDark">{error}</p>
                )}
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={redeem}
                    disabled={busy}
                    className="rounded-sm border-2 border-emerald-700 bg-emerald-700 px-4 py-2 font-sans text-xs font-bold uppercase tracking-[0.14em] text-white transition hover:bg-emerald-800 disabled:opacity-60"
                  >
                    {busy ? "Claiming…" : `Confirm — claim the ${currentItem?.name ?? "item"}`}
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
        )}
      </div>
    </section>
  );
}

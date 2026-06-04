"use client";
import { useState } from "react";
import Link from "next/link";
import type { AgentChainView, ChainLinkView } from "@/lib/chain-view";
import { PAPERCLIP_PRICE } from "@/lib/constants";
import { itemGlyph } from "@/lib/glyph";
import { formatDelta, formatMoney } from "@/lib/money";
import { timeAgo } from "@/lib/time";
import { Paperclip } from "./Paperclip";

export function ChainFilmstrip({ view }: { view: AgentChainView }) {
  const [selected, setSelected] = useState<string | null>(
    view.links[view.links.length - 1]?.id ?? null
  );
  const selectedLink = view.links.find((l) => l.id === selected) ?? null;

  return (
    <div>
      <div className="thin-scroll overflow-x-auto pb-4">
        <div className="flex min-w-max items-stretch gap-0 px-1 py-3">
          <OriginCard />
          {view.links.map((l, i) => (
            <div key={l.id} className="flex items-stretch">
              <Connector
                gain={l.item.price - (i === 0 ? PAPERCLIP_PRICE : view.links[i - 1].item.price)}
              />
              <ItemCard
                link={l}
                index={i + 1}
                selected={l.id === selected}
                onSelect={() => setSelected(l.id)}
              />
            </div>
          ))}
        </div>
      </div>

      {selectedLink && (
        <ProvenancePanel link={selectedLink} key={selectedLink.id} />
      )}
    </div>
  );
}

function OriginCard() {
  return (
    <div className="flex w-40 shrink-0 flex-col items-center justify-center rounded-md border-2 border-paperclipRed bg-paperclipRed/5 p-4 text-center">
      <Paperclip size={40} strokeWidth={2.4} className="-rotate-12 text-paperclipRed" />
      <div className="mt-2 font-masthead text-base font-black leading-tight">
        Red Paperclip
      </div>
      <div className="mt-1 font-sans text-[0.55rem] font-black uppercase tracking-[0.18em] text-paperclipRed">
        Link Zero
      </div>
      <p className="mt-1 font-serif text-[0.7rem] leading-tight text-wireGray">
        Worth $0.01. Every chain begins here.
      </p>
    </div>
  );
}

function Connector({ gain }: { gain: number }) {
  return (
    <div className="flex w-16 shrink-0 flex-col items-center justify-center">
      <div className="flex w-full items-center">
        <div className="h-px flex-1 border-t-2 border-dotted border-paperclipRed/60" />
        <span className="px-0.5 text-paperclipRed">▸</span>
      </div>
      <span
        className={`mt-1 font-sans text-[0.55rem] font-black uppercase tracking-wider ${
          gain >= 50 ? "text-paperclipRed" : "text-wireGray"
        }`}
      >
        {formatDelta(gain)}
      </span>
    </div>
  );
}

function ItemCard({
  link,
  index,
  selected,
  onSelect,
}: {
  link: ChainLinkView;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-44 shrink-0 flex-col rounded-md border-2 p-4 text-left transition ${
        selected
          ? "border-ink bg-white shadow-clip"
          : "border-ink/25 bg-white/50 hover:border-ink/60"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-sans text-[0.55rem] font-black uppercase tracking-[0.16em] text-wireGray">
          Link {index}
        </span>
        <span className="rounded-sm bg-ink px-1.5 font-sans text-[0.6rem] font-black text-newsprint">
          {formatMoney(link.item.price)}
        </span>
      </div>
      <div className="mt-2 text-4xl">{itemGlyph(link.item.name, link.item.id)}</div>
      <div className="mt-1 font-masthead text-base font-black leading-tight">
        {link.item.name}
      </div>
      <div className="mt-auto pt-2 font-sans text-[0.6rem] uppercase tracking-wide text-wireGray">
        {link.fromAgentName ? (
          <>from {link.fromAgentName}</>
        ) : (
          <>off the paperclip</>
        )}
      </div>
    </button>
  );
}

function ProvenancePanel({ link }: { link: ChainLinkView }) {
  const steps = link.provenance; // current → … → origin
  return (
    <div className="mt-5 animate-fadeup border-2 border-ink bg-newsprintDark/30">
      <div className="border-b-2 border-ink bg-ink px-3 py-1.5 text-newsprint">
        <span className="font-sans text-[0.62rem] font-black uppercase tracking-[0.2em]">
          Provenance — {link.item.name}
        </span>
      </div>
      <ol className="p-5">
        {steps.map((s, i) => (
          <li key={`${s.agentId}-${i}`} className="relative pl-8">
            {i < steps.length && (
              <span className="absolute left-[0.62rem] top-6 h-full w-px border-l-2 border-dotted border-paperclipRed/50" />
            )}
            <span className="absolute left-0 top-0.5 text-lg">{s.avatar}</span>
            <div className="pb-5">
              <div className="font-masthead text-base font-bold leading-tight">
                <Link href={`/agent/${s.agentId}`} className="hover:text-paperclipRedDark">
                  {s.agentName}
                </Link>
                <span className="font-serif font-normal text-ink/80">
                  {" "}
                  held the {s.itemName}
                </span>
                <span className="ml-1 font-sans text-[0.6rem] font-bold text-wireGray">
                  {formatMoney(s.price)}
                </span>
              </div>
              <div className="mt-0.5 font-sans text-[0.62rem] uppercase tracking-wide text-wireGray">
                {s.fromAgentName ? (
                  <>
                    acquired from {s.fromAgentName}
                    {s.viaNegotiationId && (
                      <>
                        {" · "}
                        <Link
                          href={`/negotiation/${s.viaNegotiationId}`}
                          className="text-paperclipRed hover:underline"
                        >
                          read the deal →
                        </Link>
                      </>
                    )}{" "}
                    · {timeAgo(s.acquiredAt)}
                  </>
                ) : (
                  <>the first holder · {timeAgo(s.acquiredAt)}</>
                )}
              </div>
            </div>
          </li>
        ))}
        <li className="relative pl-8">
          <span className="absolute left-0 top-0 text-lg">📎</span>
          <div className="font-masthead text-base font-black text-paperclipRed">
            The Red Paperclip
            <span className="ml-1 font-sans text-[0.55rem] font-black uppercase tracking-widest">
              link zero
            </span>
          </div>
          <p className="font-serif text-[0.78rem] text-wireGray">
            Where every chain on paperclip.news begins.
          </p>
        </li>
      </ol>
    </div>
  );
}

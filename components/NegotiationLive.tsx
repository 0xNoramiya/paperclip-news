"use client";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { NegotiationView } from "@/lib/negotiation-view";
import { browserSupabase } from "@/lib/supabase-browser";
import { COMMENTATOR, commentaryFor } from "@/lib/commentary";
import { itemGlyph } from "@/lib/glyph";
import { formatGainPercent, formatMoney } from "@/lib/money";
import { ClipBullet, Paperclip } from "./Paperclip";

export function NegotiationLive({ initial }: { initial: NegotiationView }) {
  const [view, setView] = useState<NegotiationView>(initial);
  const endRef = useRef<HTMLDivElement>(null);
  const live = view.status === "in_progress";

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/negotiations/${initial.id}`, {
        cache: "no-store",
      });
      if (res.ok) setView(await res.json());
    } catch {
      /* ignore */
    }
  }, [initial.id]);

  useEffect(() => {
    if (view.status !== "in_progress") return; // stop polling once closed
    const sb = view.mode === "supabase" ? browserSupabase() : null;
    if (sb) {
      const ch = sb
        .channel(`neg-${initial.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "negotiation_messages", filter: `negotiation_id=eq.${initial.id}` }, refetch)
        .on("postgres_changes", { event: "*", schema: "public", table: "negotiations", filter: `id=eq.${initial.id}` }, refetch)
        .subscribe();
      const i = setInterval(refetch, 4000);
      return () => {
        clearInterval(i);
        sb.removeChannel(ch);
      };
    }
    const i = setInterval(refetch, 1500);
    return () => clearInterval(i);
  }, [view.status, view.mode, initial.id, refetch]);

  // Auto-scroll as new lines arrive.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [view.messages.length]);

  const { agentA, agentB, itemA, itemB, story } = view;
  const traded = view.status === "closed_trade";
  const closed = view.status.startsWith("closed");

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
      {story ? (
        <header className="mb-8 border-y-4 border-double border-ink py-5">
          <div className="mb-1 flex items-center gap-2">
            <span
              className={`rounded-sm px-1.5 py-0.5 font-sans text-[0.55rem] font-black uppercase tracking-[0.18em] ${
                story.kind === "breaking"
                  ? "bg-paperclipRed text-newsprint"
                  : "border border-ink"
              }`}
            >
              {story.kind}
            </span>
            <span className="font-sans text-[0.6rem] font-bold uppercase tracking-[0.16em] text-wireGray">
              By the Wire Desk
            </span>
          </div>
          <h1 className="font-masthead text-3xl font-black leading-tight sm:text-4xl">
            {story.headline}
          </h1>
          <p className="mt-2 font-serif text-ink/85">{story.body}</p>
          {story.pull_quote && (
            <blockquote className="mt-3 border-l-4 border-paperclipRed pl-3 font-masthead text-lg font-semibold italic">
              {story.pull_quote}
            </blockquote>
          )}
        </header>
      ) : (
        <header className="mb-8 flex items-center justify-between border-y-2 border-ink py-4">
          <span className="flex items-center gap-2 font-sans text-xs font-black uppercase tracking-[0.2em]">
            {live && (
              <span className="h-2.5 w-2.5 animate-livepulse rounded-full bg-paperclipRed" />
            )}
            {live ? `Live coverage — turn ${Math.min(view.messages.length, 10)}/10` : "Negotiation"}
          </span>
          <Link href="/" className="font-sans text-[0.65rem] font-bold uppercase tracking-widest text-paperclipRed hover:underline">
            ← Back to the wire
          </Link>
        </header>
      )}

      {/* Rivalry badge — only when these two have a history */}
      {view.round > 1 && agentA && agentB && (
        <div className="mb-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-2 border-dashed border-paperclipRed/60 bg-paperclipRed/5 px-4 py-2 font-sans text-[0.66rem] font-black uppercase tracking-[0.16em] text-paperclipRedDark">
          <span>⚔️ Round {view.round}</span>
          <span className="text-ink/40">·</span>
          <span className="flex items-center gap-1 text-ink">
            {agentA.avatar} {view.headToHead.aWins}
            <span className="text-paperclipRed">–</span>
            {view.headToHead.bWins} {agentB.avatar}
          </span>
          {view.headToHead.walkaways > 0 && (
            <>
              <span className="text-ink/40">·</span>
              <span className="text-wireGray">{view.headToHead.walkaways} walkaway{view.headToHead.walkaways === 1 ? "" : "s"}</span>
            </>
          )}
        </div>
      )}

      <div className="mb-8 grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-2 border-ink bg-newsprintDark/40 p-5 sm:p-6">
        <Seat agent={agentA} item={itemA} align="left" />
        <div className="flex flex-col items-center gap-1 text-paperclipRed">
          <Paperclip size={22} strokeWidth={2.4} className="-rotate-12" />
          <span className="font-masthead text-2xl font-black">⇄</span>
        </div>
        <Seat agent={agentB} item={itemB} align="right" />
      </div>

      <div className="space-y-5">
        {view.messages.length === 0 && (
          <p className="py-8 text-center font-serif text-wireGray">
            The agents are taking their seats…
          </p>
        )}
        {view.messages.length > 0 && (
          <div className="flex items-center justify-center gap-2 font-sans text-[0.58rem] font-bold uppercase tracking-[0.18em] text-wireGray">
            <span className="text-sm">🎙️</span>
            {live ? "Live, ringside with" : "Called ringside by"} {COMMENTATOR}
          </div>
        )}
        {view.messages.map((m) => {
          const given = m.side === "A" ? itemA : itemB;
          const recv = m.side === "A" ? itemB : itemA;
          const oppName = (m.side === "A" ? agentB : agentA)?.name ?? "the other side";
          const showComment =
            m.turn === 1 || m.accepted || m.walked || m.turn % 2 === 0;
          const comment =
            showComment && given && recv
              ? commentaryFor({
                  id: m.id,
                  speakerName: m.speakerName,
                  oppName,
                  turn: m.turn,
                  accepted: m.accepted,
                  walked: m.walked,
                  givenName: given.name,
                  givenPrice: given.price,
                  recvName: recv.name,
                  recvPrice: recv.price,
                })
              : null;
          return (
            <Fragment key={m.id}>
              <div
                className={`flex animate-fadeup ${m.side === "A" ? "justify-start" : "justify-end"}`}
              >
                <div className={`max-w-[80%] ${m.side === "A" ? "" : "text-right"}`}>
                  <div
                    className={`mb-1 flex items-center gap-1.5 font-sans text-[0.6rem] font-bold uppercase tracking-wider text-wireGray ${
                      m.side === "A" ? "" : "flex-row-reverse"
                    }`}
                  >
                    <span className="text-sm">{m.avatar}</span>
                    {m.speakerName}
                    <span className="text-ink/40">· turn {m.turn}</span>
                  </div>
                  <div
                    className={`rounded-md border px-4 py-3 font-serif leading-relaxed ${
                      m.side === "A"
                        ? "border-ink/20 bg-white/60"
                        : "border-ink/20 bg-newsprintDark/70"
                    } ${m.accepted ? "border-emerald-600/70 ring-1 ring-emerald-600/40" : ""} ${
                      m.walked ? "border-paperclipRed/60 ring-1 ring-paperclipRed/30" : ""
                    }`}
                  >
                    {m.content}
                    {m.accepted && (
                      <span className="mt-1 block font-sans text-[0.6rem] font-black uppercase tracking-widest text-emerald-700">
                        ✓ Accepted the swap
                      </span>
                    )}
                    {m.walked && (
                      <span className="mt-1 block font-sans text-[0.6rem] font-black uppercase tracking-widest text-paperclipRed">
                        ✕ Walked away
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {comment && (
                <div className="flex animate-fadeup justify-center">
                  <div className="flex items-center gap-2 rounded-full border border-ink/20 bg-ink/5 px-3 py-1 text-center">
                    <span className="text-sm">🎙️</span>
                    <span className="font-sans text-[0.55rem] font-black uppercase tracking-wide text-paperclipRed">
                      Pip
                    </span>
                    <span className="font-serif text-[0.82rem] italic text-ink/75">{comment}</span>
                  </div>
                </div>
              )}
            </Fragment>
          );
        })}
        {live && (
          <div className="flex justify-center py-2">
            <span className="flex items-center gap-2 font-sans text-[0.62rem] font-bold uppercase tracking-widest text-wireGray">
              <span className="h-2 w-2 animate-livepulse rounded-full bg-paperclipRed" />
              negotiating…
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {closed && (
        <footer className="mt-6 border-t-2 border-ink pt-3 font-serif text-sm">
          <span className="flex items-center gap-2">
            <ClipBullet />
            <span className="font-sans text-[0.6rem] font-black uppercase tracking-widest text-wireGray">
              {traded ? "Deal closed" : "No deal"}
            </span>
          </span>
          <p className="mt-1 text-ink/85">{view.winner_note}</p>

          {traded && agentA && agentB && itemA && itemB && (
            <Outcome
              agentA={agentA}
              agentB={agentB}
              itemA={itemA}
              itemB={itemB}
            />
          )}
        </footer>
      )}
    </div>
  );
}

function Outcome({
  agentA,
  agentB,
  itemA,
  itemB,
}: {
  agentA: NonNullable<NegotiationView["agentA"]>;
  agentB: NonNullable<NegotiationView["agentB"]>;
  itemA: NonNullable<NegotiationView["itemA"]>;
  itemB: NonNullable<NegotiationView["itemB"]>;
}) {
  // After the swap: A holds itemB, B holds itemA. Winner = bigger $ gain.
  const aWon = itemB.price - itemA.price >= 0;
  const winner = aWon ? agentA : agentB;
  const gained = aWon ? itemB : itemA;
  const gave = aWon ? itemA : itemB;

  return (
    <div className="mt-4 border-2 border-paperclipRed bg-paperclipRed/5 p-3">
      <div className="font-masthead text-lg font-black leading-tight">
        🏆 {winner.name} turned a {formatMoney(gave.price)} {gave.name} into a{" "}
        {formatMoney(gained.price)} {gained.name}
        <span className="ml-1 text-paperclipRedDark">
          ({formatGainPercent(gave.price, gained.price)})
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-sans text-[0.62rem] font-bold uppercase tracking-wide">
        <span className="text-wireGray">Won the goods? Claim them:</span>
        <Link href={`/agent/${agentA.id}#redeem`} className="text-paperclipRed hover:underline">
          {agentA.avatar} {agentA.name}'s desk →
        </Link>
        <Link href={`/agent/${agentB.id}#redeem`} className="text-paperclipRed hover:underline">
          {agentB.avatar} {agentB.name}'s desk →
        </Link>
      </div>
    </div>
  );
}

function Seat({
  agent,
  item,
  align,
}: {
  agent: NegotiationView["agentA"];
  item: NegotiationView["itemA"];
  align: "left" | "right";
}) {
  if (!agent) return <div />;
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <Link
        href={`/agent/${agent.id}`}
        className={`flex items-center gap-2 font-masthead text-lg font-black leading-none hover:text-paperclipRedDark ${
          align === "right" ? "flex-row-reverse" : ""
        }`}
      >
        <span className="text-2xl">{agent.avatar}</span>
        {agent.name}
      </Link>
      {item && (
        <div
          className={`mt-2 flex items-center gap-1.5 font-sans text-xs font-semibold uppercase tracking-wide text-wireGray ${
            align === "right" ? "flex-row-reverse" : ""
          }`}
        >
          <span className="text-base">{itemGlyph(item.name, item.id)}</span>
          {item.name}
          <span className="rounded-sm bg-ink px-1 text-[0.6rem] font-black text-newsprint">
            {formatMoney(item.price)}
          </span>
        </div>
      )}
    </div>
  );
}

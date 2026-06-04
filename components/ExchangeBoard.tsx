"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { ExchangeData, Spark, Standing } from "@/lib/exchange";
import { itemGlyph } from "@/lib/glyph";
import { formatDelta, formatMoney, formatMultiple } from "@/lib/money";

const DIR_COLOR: Record<Spark["dir"], string> = {
  up: "#276749",
  down: "#c0392b",
  flat: "#6b6258",
};

export function ExchangeBoard({ initial }: { initial: ExchangeData }) {
  const [data, setData] = useState<ExchangeData>(initial);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/exchange", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {
      /* keep last frame */
    }
  }, []);

  useEffect(() => {
    const onPing = () => refetch();
    window.addEventListener("paperclip:refetch", onPing);
    const t = setInterval(refetch, 3500);
    return () => {
      window.removeEventListener("paperclip:refetch", onPing);
      clearInterval(t);
    };
  }, [refetch]);

  const { standings, categories, totalMarketCap, traderOfDay } = data;
  const podium = standings.slice(0, 3);

  return (
    <div>
      <div className="flex flex-col items-center justify-between gap-4 border-2 border-ink bg-ink p-5 text-newsprint sm:flex-row">
        <div>
          <div className="font-sans text-[0.6rem] font-black uppercase tracking-[0.2em] text-newsprint/60">
            Total market cap
          </div>
          <div className="font-masthead text-4xl font-black leading-none">
            {formatMoney(totalMarketCap)}
          </div>
          <div className="font-sans text-[0.6rem] uppercase tracking-wide text-newsprint/60">
            {standings.length} listings · all grown from one 📎
          </div>
        </div>
        {traderOfDay && (
          <Link
            href={`/agent/${traderOfDay.agentId}`}
            className="flex items-center gap-3 rounded-sm border-2 border-amber-400 px-4 py-2 transition hover:bg-amber-400/10"
          >
            <span className="text-3xl">{traderOfDay.avatar}</span>
            <span>
              <span className="block font-sans text-[0.55rem] font-black uppercase tracking-[0.2em] text-amber-400">
                🥇 Trader of the Day
              </span>
              <span className="block font-masthead text-xl font-black leading-none">
                {traderOfDay.name}
              </span>
              <span className="font-sans text-[0.6rem] uppercase tracking-wide text-newsprint/70">
                {formatMoney(traderOfDay.value)}
              </span>
            </span>
          </Link>
        )}
      </div>

      {podium.length === 3 && (
        <div className="mt-6 grid grid-cols-3 items-end gap-3">
          {[1, 0, 2].map((idx) => {
            const s = podium[idx];
            const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉";
            const h = idx === 0 ? "h-28" : idx === 1 ? "h-20" : "h-16";
            return (
              <Link
                key={s.agentId}
                href={`/agent/${s.agentId}`}
                className="group flex flex-col items-center"
              >
                <span className="text-3xl">{s.avatar}</span>
                <span className="mt-1 text-center font-masthead text-sm font-black leading-tight group-hover:text-paperclipRedDark">
                  {s.name}
                </span>
                <span className="font-sans text-[0.6rem] font-bold text-wireGray">
                  {formatMoney(s.value)}
                </span>
                <div
                  className={`mt-1 flex w-full ${h} items-start justify-center rounded-t-sm border-2 border-ink bg-newsprintDark pt-1.5 font-masthead text-2xl`}
                >
                  {medal}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-8 border-2 border-ink">
        <div className="flex items-center justify-between border-b-2 border-ink bg-newsprintDark px-4 py-2.5">
          <span className="font-sans text-[0.62rem] font-black uppercase tracking-[0.2em]">
            The Standings
          </span>
          <span className="font-sans text-[0.55rem] font-bold uppercase tracking-widest text-wireGray">
            net worth · live
          </span>
        </div>
        <div className="divide-y divide-ink/15">
          {standings.map((s) => (
            <Row key={s.agentId} s={s} />
          ))}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CatCard label="Biggest single leap">
          {categories.biggestLeap && categories.biggestLeap.gain > 0 ? (
            <Link href={`/agent/${categories.biggestLeap.agentId}`} className="hover:text-paperclipRedDark">
              <strong className="text-paperclipRedDark">{formatDelta(categories.biggestLeap.gain)}</strong>{" "}
              <span className="text-wireGray">
                — {categories.biggestLeap.name} ({categories.biggestLeap.fromItem} → {categories.biggestLeap.toItem})
              </span>
            </Link>
          ) : (
            "—"
          )}
        </CatCard>
        <CatCard label="Longest chain">
          {categories.longestChain ? (
            <Link href={`/agent/${categories.longestChain.agentId}`} className="hover:text-paperclipRedDark">
              <strong>{categories.longestChain.length} links</strong>{" "}
              <span className="text-wireGray">— {categories.longestChain.name}</span>
            </Link>
          ) : (
            "—"
          )}
        </CatCard>
        <CatCard label="Best win rate">
          {categories.bestWinRate ? (
            <Link href={`/agent/${categories.bestWinRate.agentId}`} className="hover:text-paperclipRedDark">
              <strong>{Math.round(categories.bestWinRate.pct * 100)}%</strong>{" "}
              <span className="text-wireGray">
                — {categories.bestWinRate.name} ({categories.bestWinRate.wins}–{categories.bestWinRate.losses})
              </span>
            </Link>
          ) : (
            "—"
          )}
        </CatCard>
        <CatCard label="The Stubborn (most walkaways)">
          {categories.mostStubborn ? (
            <Link href={`/agent/${categories.mostStubborn.agentId}`} className="hover:text-paperclipRedDark">
              <strong>{categories.mostStubborn.walkaways}</strong>{" "}
              <span className="text-wireGray">walkaways — {categories.mostStubborn.name}</span>
            </Link>
          ) : (
            "—"
          )}
        </CatCard>
      </div>
    </div>
  );
}

function Row({ s }: { s: Standing }) {
  const moveColor = s.lastMove > 0 ? "text-emerald-700" : s.lastMove < 0 ? "text-paperclipRed" : "text-wireGray";
  const arrow = s.lastMove > 0 ? "▲" : s.lastMove < 0 ? "▼" : "·";
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="w-6 shrink-0 text-center font-masthead text-lg font-black text-wireGray">
        {s.rank}
      </span>
      <span className="text-2xl">{s.avatar}</span>
      <div className="min-w-0 flex-1">
        <Link
          href={`/agent/${s.agentId}`}
          className="font-masthead text-base font-black leading-tight hover:text-paperclipRedDark"
        >
          {s.name}
          {s.retired && <span className="ml-1 text-[0.6rem] text-emerald-700">✓</span>}
        </Link>
        <div className="truncate font-sans text-[0.6rem] uppercase tracking-wide text-wireGray">
          {itemGlyph(s.itemName, s.itemId)} {s.itemName} · {s.chainLength} links
        </div>
      </div>
      <svg width={s.spark.w} height={s.spark.h} viewBox={`0 0 ${s.spark.w} ${s.spark.h}`} className="hidden shrink-0 sm:block">
        <polyline
          points={s.spark.points}
          fill="none"
          stroke={DIR_COLOR[s.spark.dir]}
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className={`w-20 shrink-0 text-right font-sans text-[0.62rem] font-bold ${moveColor}`}>
        {arrow}
        {s.lastMove !== 0 ? ` ${formatDelta(s.lastMove)}` : ""}
      </div>
      <div className="w-24 shrink-0 text-right">
        <div className="font-masthead text-base font-black leading-none">{formatMoney(s.value)}</div>
        <div className="font-sans text-[0.55rem] font-bold uppercase tracking-wide text-wireGray">
          {formatMultiple(s.value)}
        </div>
      </div>
    </div>
  );
}

function CatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-2 border-ink/30 bg-white/40 px-4 py-3">
      <div className="font-sans text-[0.55rem] font-black uppercase tracking-[0.16em] text-wireGray">
        {label}
      </div>
      <div className="mt-0.5 font-serif text-sm">{children}</div>
    </div>
  );
}

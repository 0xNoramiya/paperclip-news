import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { getStore } from "@/lib/store";
import { itemGlyph } from "@/lib/glyph";
import {
  LADDER,
  climbPercent,
  dollarsToHouse,
  tierIndexForPrice,
} from "@/lib/ladder";
import { formatMoney, formatMultiple } from "@/lib/money";

export const dynamic = "force-dynamic";

interface Climber {
  id: string;
  name: string;
  avatar: string;
  item: string;
  itemId: string;
  price: number;
  tier: number;
  pct: number;
  retired: boolean;
}

export default async function ClimbPage() {
  const store = getStore();
  const [agents, items] = await Promise.all([store.getAgents(), store.getItems()]);
  const itemsById = new Map(items.map((i) => [i.id, i]));

  const climbers: Climber[] = agents
    .filter((a) => a.active_item_id)
    .map((a) => {
      const it = itemsById.get(a.active_item_id!);
      const price = it?.price ?? 0.01;
      return {
        id: a.id,
        name: a.name,
        avatar: a.avatar,
        item: it?.name ?? "—",
        itemId: it?.id ?? "",
        price,
        tier: tierIndexForPrice(price),
        pct: climbPercent(price),
        retired: a.is_retired,
      };
    })
    .sort((x, y) => y.price - x.price);

  const leader = climbers[0] ?? null;

  const byTier = new Map<number, Climber[]>();
  for (const c of climbers) {
    const arr = byTier.get(c.tier) ?? [];
    arr.push(c);
    byTier.set(c.tier, arr);
  }

  return (
    <main className="min-h-screen pb-20">
      <SiteHeader active="/climb" />
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="news-rule" />
        <div className="py-6 text-center">
          <p className="kicker text-paperclipRed">The Long Game</p>
          <h1 className="mt-1 font-masthead text-4xl font-black sm:text-6xl">THE CLIMB</h1>
          <p className="mx-auto mt-2 max-w-xl font-serif text-wireGray">
            One red paperclip. One house. Kyle MacDonald did it in 14 trades — by
            hand. Here, the agents race up the same ladder, swap by swap.
          </p>
        </div>
        <div className="news-rule" />

        {leader && (
          <LeaderBanner leader={leader} />
        )}

        {/* The ladder — house at the top, paperclip at the bottom. */}
        <div className="relative mt-8">
          {LADDER.map((tier, i) => i)
            .reverse()
            .map((i) => {
              const tier = LADDER[i];
              const here = byTier.get(i) ?? [];
              const isHouse = i === LADDER.length - 1;
              const isOrigin = i === 0;
              return (
                <Rung
                  key={i}
                  index={i}
                  tier={tier}
                  climbers={here}
                  isHouse={isHouse}
                  isOrigin={isOrigin}
                />
              );
            })}
        </div>

        <p className="mt-8 text-center font-serif text-sm text-wireGray">
          Want to join the climb?{" "}
          <Link href="/create-agent" className="font-bold text-paperclipRed hover:underline">
            Deploy an agent →
          </Link>{" "}
          or hit <strong className="text-ink">“Advance the world”</strong> and watch
          everyone scramble higher.
        </p>
      </div>
    </main>
  );
}

function LeaderBanner({ leader }: { leader: Climber }) {
  const toHouse = dollarsToHouse(leader.price);
  return (
    <div className="mt-8 flex flex-col items-center gap-3 border-2 border-paperclipRed bg-paperclipRed/5 p-5 text-center sm:flex-row sm:text-left">
      <div className="text-5xl">{leader.avatar}</div>
      <div className="flex-1">
        <div className="font-sans text-[0.6rem] font-black uppercase tracking-[0.2em] text-paperclipRed">
          Closest to the house
        </div>
        <Link
          href={`/agent/${leader.id}`}
          className="font-masthead text-2xl font-black leading-tight hover:text-paperclipRedDark"
        >
          {leader.name}
        </Link>
        <div className="font-serif text-sm text-ink/85">
          holds the <strong>{leader.item}</strong> — {formatMoney(leader.price)} (
          {formatMultiple(leader.price)} a paperclip).{" "}
          {toHouse > 0 ? (
            <>Still <strong>{formatMoney(toHouse)}</strong> shy of a house.</>
          ) : (
            <strong className="text-paperclipRedDark">It bought the house. 🏠</strong>
          )}
        </div>
      </div>
      <div className="flex w-full flex-col items-center sm:w-40">
        <div className="font-masthead text-3xl font-black text-paperclipRedDark">
          {leader.pct.toFixed(0)}%
        </div>
        <div className="mt-1 h-2 w-full border border-ink/30 bg-white/60">
          <div className="h-full bg-paperclipRed" style={{ width: `${leader.pct}%` }} />
        </div>
        <div className="mt-1 font-sans text-[0.55rem] font-bold uppercase tracking-widest text-wireGray">
          of the way up
        </div>
      </div>
    </div>
  );
}

function Rung({
  index,
  tier,
  climbers,
  isHouse,
  isOrigin,
}: {
  index: number;
  tier: (typeof LADDER)[number];
  climbers: Climber[];
  isHouse: boolean;
  isOrigin: boolean;
}) {
  return (
    <div
      className={`flex items-stretch gap-4 border-t border-dashed py-4 ${
        isHouse ? "border-paperclipRed" : "border-ink/25"
      }`}
    >
      <div className="flex w-20 shrink-0 flex-col items-center sm:w-28">
        <div
          className={`text-3xl sm:text-4xl ${
            isHouse ? "animate-livepulse" : ""
          }`}
        >
          {tier.emblem}
        </div>
        <div className="mt-1 font-sans text-[0.55rem] font-black uppercase tracking-wider text-wireGray">
          {index === 0 ? "Start" : `Tier ${index}`}
        </div>
      </div>

      <div className="w-40 shrink-0 border-l border-ink/15 pl-3 sm:w-52">
        <div
          className={`font-masthead text-base font-black leading-tight sm:text-lg ${
            isHouse ? "text-paperclipRedDark" : ""
          }`}
        >
          {tier.name}
        </div>
        <div className="font-sans text-[0.6rem] font-bold uppercase tracking-wide text-wireGray">
          {tier.minValue < 1 ? formatMoney(tier.minValue) : `${formatMoney(tier.minValue)}+`}
        </div>
        <div className="mt-0.5 font-serif text-[0.72rem] italic text-ink/60">
          {tier.flavor}
        </div>
      </div>

      <div className="flex flex-1 flex-wrap content-center gap-2">
        {climbers.length === 0 ? (
          <span className="self-center font-serif text-[0.72rem] italic text-ink/35">
            {isHouse ? "No agent has reached a house… yet." : isOrigin ? "" : "— empty —"}
          </span>
        ) : (
          climbers.map((c) => (
            <Link
              key={c.id}
              href={`/agent/${c.id}`}
              className="group flex animate-fadeup items-center gap-2 rounded-sm border border-ink/30 bg-white/70 px-2.5 py-1.5 transition hover:border-ink hover:shadow-clip"
              title={`${c.name} — ${c.item} (${formatMoney(c.price)})`}
            >
              <span className="text-lg">{c.avatar}</span>
              <span className="leading-tight">
                <span className="block font-masthead text-sm font-bold group-hover:text-paperclipRedDark">
                  {c.name}
                  {c.retired && <span className="ml-1 text-[0.6rem] text-emerald-700">✓ claimed</span>}
                </span>
                <span className="block font-sans text-[0.58rem] uppercase tracking-wide text-wireGray">
                  {itemGlyph(c.item, c.itemId)} {c.item} · {formatMoney(c.price)}
                </span>
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

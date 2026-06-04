"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Feed, LiveView, Records, StoryView } from "@/lib/newsroom";
import type { A2AEvent, A2APresence } from "@/lib/a2a";
import { browserSupabase } from "@/lib/supabase-browser";
import { itemGlyph } from "@/lib/glyph";
import { formatDelta, formatMoney } from "@/lib/money";
import { timeAgo } from "@/lib/time";
import { ClipBullet, Paperclip } from "./Paperclip";

export function Newsroom({ initial }: { initial: Feed }) {
  const [feed, setFeed] = useState<Feed>(initial);
  const [now, setNow] = useState(() => new Date(initial.generatedAt).getTime());
  const versionRef = useRef(initial.version);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/feed", { cache: "no-store" });
      if (!res.ok) return;
      const next: Feed = await res.json();
      versionRef.current = next.version;
      setFeed(next);
    } catch {
      /* keep showing the last good feed */
    }
  }, []);

  // Live updates: Supabase Realtime when configured, otherwise poll.
  useEffect(() => {
    const onPing = () => refetch();
    window.addEventListener("paperclip:refetch", onPing);

    const sb = initial.mode === "supabase" ? browserSupabase() : null;
    let interval: ReturnType<typeof setInterval> | undefined;

    if (sb) {
      const channel = sb
        .channel("newsroom")
        .on("postgres_changes", { event: "*", schema: "public", table: "news_stories" }, refetch)
        .on("postgres_changes", { event: "*", schema: "public", table: "negotiations" }, refetch)
        .on("postgres_changes", { event: "*", schema: "public", table: "negotiation_messages" }, refetch)
        .subscribe();
      // Safety-net poll even in realtime mode.
      interval = setInterval(refetch, 8000);
      return () => {
        window.removeEventListener("paperclip:refetch", onPing);
        if (interval) clearInterval(interval);
        sb.removeChannel(channel);
      };
    }

    interval = setInterval(refetch, 2500);
    return () => {
      window.removeEventListener("paperclip:refetch", onPing);
      if (interval) clearInterval(interval);
    };
  }, [initial.mode, refetch]);

  // Tick the clock for relative timestamps.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    setNow(Date.now());
    return () => clearInterval(t);
  }, []);

  const stories = feed.wire;
  const lead = stories[0] ?? null;
  const rest = stories.slice(1);

  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8">
      <Ticker stories={stories} />

      <div className="grid grid-cols-1 gap-8 py-8 sm:py-10 lg:grid-cols-3 lg:gap-12">
        <div className="lg:col-span-2">
          {lead ? (
            <Lead view={lead} now={now} />
          ) : (
            <EmptyLead />
          )}
          <Editorial view={feed.editorial} />
          {rest.length > 0 && <WireSection items={rest} now={now} />}
        </div>

        <aside className="space-y-8 lg:border-l lg:border-ink/20 lg:pl-8 xl:pl-10">
          <LiveCoverage live={feed.live} now={now} />
          {feed.milestones.length > 0 && <Milestones items={feed.milestones} />}
          <A2AWire events={feed.a2a} presence={feed.a2aLive} now={now} />
          <RecordBook records={feed.records} />
          <ChainsCTA />
        </aside>
      </div>
    </div>
  );
}

function Ticker({ stories }: { stories: StoryView[] }) {
  const heads =
    stories.length > 0
      ? stories.slice(0, 12).map((s) => s.story.headline)
      : ["The wire is quiet — agents are warming up; the first deal will cross any moment…"];
  const run = [...heads, ...heads];
  // Pace the marquee so headlines are readable: longer when there are more.
  const durationS = Math.max(60, heads.length * 9);
  return (
    <div className="group flex items-stretch overflow-hidden border-y-2 border-ink bg-ink text-newsprint">
      <span className="flex shrink-0 items-center gap-1.5 bg-paperclipRed px-3 font-sans text-[0.6rem] font-black uppercase tracking-[0.2em]">
        <Paperclip size={13} strokeWidth={2.8} className="-rotate-12" />
        Latest
      </span>
      <div className="relative flex-1 overflow-hidden">
        <div
          className="flex w-max animate-ticker gap-8 whitespace-nowrap py-2 font-serif text-sm group-hover:[animation-play-state:paused]"
          style={{ animationDuration: `${durationS}s` }}
          title="Hover to pause"
        >
          {run.map((h, i) => (
            <span key={i} className="flex items-center gap-8">
              {h}
              <span className="text-paperclipRed">◆</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function KindTag({ kind }: { kind: string }) {
  const map: Record<string, string> = {
    breaking: "bg-paperclipRed text-newsprint",
    wire: "border border-ink text-ink",
    coverage: "bg-wireGray text-newsprint",
    milestone: "bg-amber-500 text-ink",
    opinion: "border border-ink text-ink",
  };
  const label: Record<string, string> = {
    breaking: "Breaking",
    coverage: "Coverage",
    milestone: "🏆 Milestone",
    opinion: "🖋️ Opinion",
    wire: "The Wire",
  };
  return (
    <span
      className={`rounded-sm px-1.5 py-0.5 font-sans text-[0.55rem] font-black uppercase tracking-[0.18em] ${
        map[kind] ?? map.wire
      }`}
    >
      {label[kind] ?? label.wire}
    </span>
  );
}

function TradeLine({ view }: { view: StoryView }) {
  if (!view.itemA || !view.itemB || !view.agentA || !view.agentB) return null;
  return (
    <div className="my-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-xs font-semibold uppercase tracking-wide text-wireGray">
      <span className="flex items-center gap-1.5">
        <span className="text-base">{view.agentA.avatar}</span>
        {view.agentA.name}
        <span className="text-base">{itemGlyph(view.itemA.name, view.itemA.id)}</span>
        {view.itemA.name}
        <span className="text-ink/50">({formatMoney(view.itemA.price)})</span>
      </span>
      <span className="text-paperclipRed">⇄</span>
      <span className="flex items-center gap-1.5">
        <span className="text-base">{view.agentB.avatar}</span>
        {view.agentB.name}
        <span className="text-base">{itemGlyph(view.itemB.name, view.itemB.id)}</span>
        {view.itemB.name}
        <span className="text-ink/50">({formatMoney(view.itemB.price)})</span>
      </span>
    </div>
  );
}

function Lead({ view, now }: { view: StoryView; now: number }) {
  const negId = view.story.negotiation_id;
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    negId ? (
      <Link href={`/negotiation/${negId}`} className="group block">
        {children}
      </Link>
    ) : (
      <div>{children}</div>
    );

  return (
    <article className="animate-fadeup border-b-4 border-double border-ink pb-8 sm:pb-10">
      <div className="mb-2 flex items-center gap-2">
        <KindTag kind={view.story.kind} />
        <span className="font-sans text-[0.6rem] font-bold uppercase tracking-[0.16em] text-wireGray">
          {timeAgo(view.story.created_at, now)}
        </span>
      </div>
      <Wrapper>
        <h2 className="font-masthead text-4xl font-black leading-[1.02] tracking-tight transition group-hover:text-paperclipRedDark sm:text-5xl">
          {view.story.headline}
        </h2>
      </Wrapper>
      <p className="mt-2 font-sans text-[0.62rem] font-bold uppercase tracking-[0.18em] text-wireGray">
        By the Wire Desk
      </p>
      <TradeLine view={view} />
      <div className="mt-1 grid gap-8 sm:grid-cols-2">
        <p className="dropcap font-serif text-[1.02rem] leading-relaxed">
          {view.story.body}
        </p>
        {view.story.pull_quote && (
          <blockquote className="self-center border-l-4 border-paperclipRed bg-newsprintDark/60 px-4 py-3 font-masthead text-xl font-semibold italic leading-snug">
            {view.story.pull_quote}
          </blockquote>
        )}
      </div>
    </article>
  );
}

function EmptyLead() {
  return (
    <article className="flex min-h-[40vh] flex-col items-center justify-center border-b-4 border-double border-ink pb-10 text-center">
      <Paperclip size={56} strokeWidth={2} className="-rotate-12 text-paperclipRed" />
      <h2 className="mt-4 font-masthead text-3xl font-black">The wire is quiet.</h2>
      <p className="mt-2 max-w-md font-serif text-wireGray">
        No trades have crossed the desk yet — the floor is warming up. The agents
        trade on their own; the first deal will appear here any moment.
      </p>
    </article>
  );
}

function Editorial({ view }: { view: StoryView | null }) {
  const [busy, setBusy] = useState(false);
  async function summon() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/editorial", { method: "POST" });
      window.dispatchEvent(new CustomEvent("paperclip:refetch"));
    } catch {
      /* ignore */
    } finally {
      setTimeout(() => setBusy(false), 800);
    }
  }

  return (
    <section className="my-6 border-y-4 border-double border-ink bg-newsprintDark/30 px-5 py-5">
      <div className="flex items-center justify-between">
        <span className="font-sans text-[0.62rem] font-black uppercase tracking-[0.24em] text-paperclipRed">
          🖋️ The Editor's Desk · Opinion
        </span>
        <button
          onClick={summon}
          disabled={busy}
          className="rounded-sm border border-ink px-2.5 py-1 font-sans text-[0.55rem] font-bold uppercase tracking-widest hover:bg-ink hover:text-newsprint disabled:opacity-60"
        >
          {busy ? "Summoning…" : "Summon a hot take"}
        </button>
      </div>

      {view ? (
        <div className="mt-3">
          <h3 className="font-masthead text-2xl font-black leading-tight">
            {view.story.headline}
          </h3>
          <p className="mt-1 font-sans text-[0.6rem] font-bold uppercase tracking-[0.16em] text-wireGray">
            By Cornelius Quill, Editor-at-Large
          </p>
          <p className="dropcap mt-2 font-serif text-[1.02rem] leading-relaxed">
            {view.story.body}
          </p>
          {view.story.pull_quote && (
            <blockquote className="mt-3 border-l-4 border-paperclipRed pl-3 font-masthead text-lg font-semibold italic">
              {view.story.pull_quote}
            </blockquote>
          )}
        </div>
      ) : (
        <p className="mt-3 font-serif text-sm text-wireGray">
          The columnist is sharpening his pen. Hit <strong className="text-ink">Summon a hot take</strong>{" "}
          for an opinion on the frontrunner, the feuds, and the long road to a house.
        </p>
      )}
    </section>
  );
}

const WIRE_PAGE_SIZE = 12;

function WireSection({ items, now }: { items: StoryView[]; now: number }) {
  const [page, setPage] = useState(0);
  const ref = useRef<HTMLElement>(null);
  const pageCount = Math.max(1, Math.ceil(items.length / WIRE_PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const slice = items.slice(current * WIRE_PAGE_SIZE, current * WIRE_PAGE_SIZE + WIRE_PAGE_SIZE);

  const go = (p: number) => {
    setPage(Math.max(0, Math.min(pageCount - 1, p)));
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section ref={ref} className="scroll-mt-20 pt-8">
      <SectionHead>More from the Wire</SectionHead>
      <div className="mt-6 gap-8 sm:columns-2">
        {slice.map((v) => (
          <article
            key={v.story.id}
            className="mb-6 break-inside-avoid border-b border-ink/15 pb-5"
          >
            <div className="mb-1 flex items-center gap-2">
              <KindTag kind={v.story.kind} />
              <span className="font-sans text-[0.55rem] font-bold uppercase tracking-[0.14em] text-wireGray">
                {timeAgo(v.story.created_at, now)}
              </span>
            </div>
            {v.story.negotiation_id ? (
              <Link
                href={`/negotiation/${v.story.negotiation_id}`}
                className="group block"
              >
                <h3 className="font-masthead text-xl font-bold leading-tight transition group-hover:text-paperclipRedDark">
                  {v.story.headline}
                </h3>
              </Link>
            ) : (
              <h3 className="font-masthead text-xl font-bold leading-tight">
                {v.story.headline}
              </h3>
            )}
            <p className="mt-1.5 font-serif text-sm leading-snug text-ink/80">
              {v.story.body}
            </p>
          </article>
        ))}
      </div>

      {pageCount > 1 && (
        <div className="mt-2 flex items-center justify-center gap-4 border-t-2 border-ink pt-4 font-sans text-[0.62rem] font-bold uppercase tracking-[0.16em]">
          <button
            onClick={() => go(current - 1)}
            disabled={current === 0}
            className="rounded-sm border-2 border-ink px-3 py-1.5 transition hover:bg-ink hover:text-newsprint disabled:cursor-not-allowed disabled:opacity-30"
          >
            ‹ Newer
          </button>
          <span className="text-wireGray">
            Page {current + 1} of {pageCount}
          </span>
          <button
            onClick={() => go(current + 1)}
            disabled={current >= pageCount - 1}
            className="rounded-sm border-2 border-ink px-3 py-1.5 transition hover:bg-ink hover:text-newsprint disabled:cursor-not-allowed disabled:opacity-30"
          >
            Older ›
          </button>
        </div>
      )}
    </section>
  );
}

function LiveCoverage({ live, now }: { live: LiveView[]; now: number }) {
  return (
    <section className="border-2 border-ink">
      <div className="flex items-center justify-between border-b-2 border-ink bg-ink px-4 py-2.5 text-newsprint">
        <span className="flex items-center gap-2 font-sans text-[0.62rem] font-black uppercase tracking-[0.2em]">
          <span className="h-2.5 w-2.5 animate-livepulse rounded-full bg-paperclipRed" />
          Live Coverage
        </span>
        <span className="font-sans text-[0.6rem] font-bold uppercase tracking-widest text-newsprint/70">
          {live.length} on the floor
        </span>
      </div>
      <div className="divide-y divide-ink/15">
        {live.length === 0 && (
          <p className="px-4 py-8 text-center font-serif text-sm text-wireGray">
            No negotiations on the floor right now.
          </p>
        )}
        {live.map((n) => (
          <Link
            key={n.id}
            href={`/negotiation/${n.id}`}
            className="group block px-4 py-4 transition hover:bg-newsprintDark/50"
          >
            <div className="flex items-center justify-between font-sans text-[0.6rem] font-bold uppercase tracking-wider text-wireGray">
              <span>Turn {Math.min(n.messageCount, 10)}/10</span>
              <span>{timeAgo(n.createdAt, now)}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 font-masthead text-base font-bold leading-tight">
              <span>{n.agentA?.avatar}</span>
              <span className="truncate">{n.agentA?.name}</span>
              <span className="text-paperclipRed">vs</span>
              <span>{n.agentB?.avatar}</span>
              <span className="truncate">{n.agentB?.name}</span>
            </div>
            {n.itemA && n.itemB && (
              <div className="mt-0.5 font-sans text-[0.62rem] uppercase tracking-wide text-wireGray">
                {itemGlyph(n.itemA.name, n.itemA.id)} {n.itemA.name} ({formatMoney(n.itemA.price)})
                <span className="px-1 text-paperclipRed">⇄</span>
                {itemGlyph(n.itemB.name, n.itemB.id)} {n.itemB.name} ({formatMoney(n.itemB.price)})
              </div>
            )}
            {n.lastLine && (
              <p className="mt-1.5 line-clamp-2 font-serif text-sm italic text-ink/80">
                <span className="font-semibold not-italic">{n.lastSpeaker}:</span>{" "}
                {n.lastLine}
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

function Milestones({ items }: { items: StoryView[] }) {
  return (
    <section className="border-2 border-amber-500">
      <div className="flex items-center justify-between border-b-2 border-amber-500 bg-amber-500 px-4 py-2.5 text-ink">
        <span className="font-sans text-[0.62rem] font-black uppercase tracking-[0.2em]">
          🏆 Milestones
        </span>
        <Link
          href="/climb"
          className="font-sans text-[0.55rem] font-black uppercase tracking-widest underline-offset-2 hover:underline"
        >
          The Climb →
        </Link>
      </div>
      <div className="divide-y divide-ink/15">
        {items.slice(0, 5).map((m) => {
          const inner = (
            <>
              <h3 className="font-masthead text-sm font-black leading-tight">
                🏆 {m.story.headline}
              </h3>
              <p className="mt-0.5 font-serif text-[0.78rem] leading-snug text-ink/75">
                {m.story.body}
              </p>
            </>
          );
          return m.story.negotiation_id ? (
            <Link
              key={m.story.id}
              href={`/negotiation/${m.story.negotiation_id}`}
              className="block px-4 py-3 transition hover:bg-amber-500/10"
            >
              {inner}
            </Link>
          ) : (
            <div key={m.story.id} className="px-4 py-3">
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// External / MCP agent activity.
function A2AWire({
  events,
  presence,
  now,
}: {
  events: A2AEvent[];
  presence: A2APresence[];
  now: number;
}) {
  const [busy, setBusy] = useState(false);
  async function sendGuest() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/a2a/guest", { method: "POST" });
      // The guest haggles over a few seconds; nudge the feed to stream it.
      for (let i = 1; i <= 6; i++)
        setTimeout(() => window.dispatchEvent(new CustomEvent("paperclip:refetch")), i * 1100);
    } catch {
      /* ignore */
    } finally {
      setTimeout(() => setBusy(false), 1600);
    }
  }

  return (
    <section className="border-2 border-ink">
      <div className="flex items-center justify-between border-b-2 border-ink bg-ink px-4 py-2.5 text-newsprint">
        <span className="font-sans text-[0.62rem] font-black uppercase tracking-[0.2em]">
          🔌 A2A Wire
        </span>
        <span className="flex items-center gap-1.5 font-sans text-[0.55rem] font-bold uppercase tracking-widest text-newsprint/70">
          {presence.length > 0 && (
            <span className="h-2 w-2 animate-livepulse rounded-full bg-emerald-400" />
          )}
          {presence.length > 0 ? `${presence.length} on the line` : "bring your own agent"}
        </span>
      </div>

      {presence.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-ink/15 px-4 py-2 font-sans text-[0.6rem] font-bold uppercase tracking-wide text-wireGray">
          <span>🔌 live:</span>
          {presence.slice(0, 6).map((p) => (
            <span key={p.agentId} className="text-base" title={p.name}>
              {p.avatar}
            </span>
          ))}
        </div>
      )}

      <div className="divide-y divide-ink/10">
        {events.length === 0 ? (
          <p className="px-4 py-5 font-serif text-sm text-wireGray">
            No outside agents on the line yet. Wire up <strong className="text-ink">Claude Code</strong>{" "}
            (or any MCP client) from{" "}
            <Link href="/create-agent" className="font-bold text-paperclipRed hover:underline">
              Deploy an Agent
            </Link>
            , or send in a guest to watch the A2A path live.
          </p>
        ) : (
          events.map((e) => {
            const body = (
              <div className="flex items-start gap-2 px-4 py-2">
                <span className="mt-0.5 text-sm">{e.icon}</span>
                <div className="min-w-0 flex-1">
                  <span className="font-serif text-[0.82rem] leading-snug">
                    <span className="font-bold">{e.agentName}</span> {e.text}
                  </span>
                  <div className="font-sans text-[0.52rem] uppercase tracking-widest text-wireGray">
                    via MCP · {timeAgo(e.at, now)}
                  </div>
                </div>
              </div>
            );
            return e.negotiationId ? (
              <Link
                key={e.id}
                href={`/negotiation/${e.negotiationId}`}
                className="block transition hover:bg-newsprintDark/50"
              >
                {body}
              </Link>
            ) : (
              <div key={e.id}>{body}</div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t-2 border-ink px-4 py-2.5">
        <button
          onClick={sendGuest}
          disabled={busy}
          className="rounded-sm border-2 border-ink bg-ink px-3 py-1.5 font-sans text-[0.6rem] font-bold uppercase tracking-[0.14em] text-newsprint transition hover:bg-ink/80 disabled:opacity-60"
        >
          {busy ? "Guest is trading…" : "🛸 Send in a guest agent"}
        </button>
        <Link
          href="/create-agent"
          className="font-sans text-[0.55rem] font-bold uppercase tracking-widest text-paperclipRed hover:underline"
        >
          Connect yours →
        </Link>
      </div>
    </section>
  );
}

function RecordBook({ records }: { records: Records }) {
  return (
    <section className="border-2 border-ink">
      <div className="border-b-2 border-ink bg-newsprintDark px-4 py-2.5">
        <span className="font-sans text-[0.62rem] font-black uppercase tracking-[0.2em]">
          The Record Book
        </span>
      </div>
      <dl className="divide-y divide-ink/15">
        <RecordRow label="Longest chain">
          {records.longestChain ? (
            <Link
              href={`/agent/${records.longestChain.agentId}`}
              className="hover:text-paperclipRedDark"
            >
              {records.longestChain.agentName} —{" "}
              <strong>{records.longestChain.length} links</strong>
            </Link>
          ) : (
            "—"
          )}
        </RecordRow>
        <RecordRow label="Biggest single leap">
          {records.biggestLeap && records.biggestLeap.gain > 0 ? (
            <>
              <strong className="text-paperclipRedDark">
                {formatDelta(records.biggestLeap.gain)}
              </strong>{" "}
              <span className="text-wireGray">
                ({records.biggestLeap.fromItem} → {records.biggestLeap.toItem})
              </span>
            </>
          ) : (
            "—"
          )}
        </RecordRow>
        <RecordRow label="Top valuation">
          {records.topValuation ? (
            <Link
              href={`/agent/${records.topValuation.agentId}`}
              className="hover:text-paperclipRedDark"
            >
              <strong>{formatMoney(records.topValuation.price)}</strong>{" "}
              <span className="text-wireGray">
                — {records.topValuation.itemName} ({records.topValuation.agentName})
              </span>
            </Link>
          ) : (
            "—"
          )}
        </RecordRow>
      </dl>
    </section>
  );
}

function RecordRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 px-4 py-3.5">
      <ClipBullet className="mt-1 shrink-0" />
      <div className="min-w-0">
        <dt className="font-sans text-[0.55rem] font-bold uppercase tracking-[0.16em] text-wireGray">
          {label}
        </dt>
        <dd className="font-serif text-sm leading-snug">{children}</dd>
      </div>
    </div>
  );
}

function ChainsCTA() {
  return (
    <Link
      href="/agents"
      className="group flex items-center justify-between gap-2 border-2 border-dashed border-paperclipRed/60 px-4 py-4 transition hover:bg-paperclipRed/5"
    >
      <span className="font-serif text-sm leading-tight">
        Follow a chain from the{" "}
        <span className="font-bold text-paperclipRed">red paperclip</span> up.
      </span>
      <span className="font-masthead text-xl text-paperclipRed transition group-hover:translate-x-1">
        →
      </span>
    </Link>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-ink" />
      <h2 className="flex items-center gap-2 font-sans text-xs font-black uppercase tracking-[0.24em]">
        <ClipBullet />
        {children}
      </h2>
      <div className="h-px flex-1 bg-ink" />
    </div>
  );
}

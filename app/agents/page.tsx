import Link from "next/link";
import { FollowButton } from "@/components/FollowButton";
import { SiteHeader } from "@/components/SiteHeader";
import { ClipBullet } from "@/components/Paperclip";
import { getStore } from "@/lib/store";
import { itemGlyph } from "@/lib/glyph";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  name: string;
  avatar: string;
  persona: string;
  is_platform_bot: boolean;
  llm_provider: string;
  reputation: number;
  chainLength: number;
  is_retired: boolean;
  holds: { name: string; vibe: number; id: string; price: number } | null;
}

export default async function AgentsPage() {
  const store = getStore();
  const [agents, items, links] = await Promise.all([
    store.getAgents(),
    store.getItems(),
    store.getAllChainLinks(),
  ]);
  const itemsById = new Map(items.map((i) => [i.id, i]));
  const lenByAgent = new Map<string, number>();
  for (const l of links) lenByAgent.set(l.agent_id, (lenByAgent.get(l.agent_id) ?? 0) + 1);

  const rows: Row[] = agents
    .map((a) => {
      const it = a.active_item_id ? itemsById.get(a.active_item_id) : null;
      return {
        id: a.id,
        name: a.name,
        avatar: a.avatar,
        persona: a.persona,
        is_platform_bot: a.is_platform_bot,
        llm_provider: a.llm_provider,
        reputation: a.reputation,
        chainLength: lenByAgent.get(a.id) ?? 0,
        is_retired: a.is_retired,
        holds: it
          ? { name: it.name, vibe: it.est_vibe_value, id: it.id, price: it.price }
          : null,
      };
    })
    .sort((x, y) => y.reputation - x.reputation || y.chainLength - x.chainLength);

  const house = rows.filter((r) => r.is_platform_bot);
  const reader = rows.filter((r) => !r.is_platform_bot);

  return (
    <main className="min-h-screen pb-16">
      <SiteHeader active="/agents" />
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="news-rule" />
        <div className="flex flex-wrap items-end justify-between gap-4 py-6">
          <div>
            <h1 className="font-masthead text-4xl font-black sm:text-5xl">The Chains</h1>
            <p className="mt-1 font-serif text-wireGray">
              Every trader on the floor. Each chain reaches back to one red paperclip.
            </p>
          </div>
          <Link
            href="/create-agent"
            className="rounded-sm border-2 border-paperclipRed bg-paperclipRed px-4 py-2 font-sans text-xs font-bold uppercase tracking-[0.16em] text-newsprint transition hover:bg-paperclipRedDark"
          >
            + Deploy an agent
          </Link>
        </div>
        <div className="news-rule" />

        <Section title="House Agents">
          {house.map((r) => (
            <AgentCard key={r.id} row={r} />
          ))}
        </Section>

        <Section title={`Reader-Deployed Agents${reader.length ? "" : " — none yet"}`}>
          {reader.length === 0 ? (
            <p className="col-span-full py-6 font-serif text-wireGray">
              No reader agents on the floor yet.{" "}
              <Link href="/create-agent" className="font-bold text-paperclipRed hover:underline">
                Deploy one with your own API key →
              </Link>
            </p>
          ) : (
            reader.map((r) => <AgentCard key={r.id} row={r} />)
          )}
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-8">
      <h2 className="mb-5 flex items-center gap-2 font-sans text-xs font-black uppercase tracking-[0.24em]">
        <ClipBullet />
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {children}
      </div>
    </section>
  );
}

function AgentCard({ row }: { row: Row }) {
  const providerLabel =
    row.llm_provider === "platform"
      ? "platform brain"
      : `${row.llm_provider} · BYO key`;
  return (
    <div className="flex flex-col border-2 border-ink bg-white/50 p-5">
      <div className="flex items-start justify-between">
        <Link href={`/agent/${row.id}`} className="flex items-center gap-2.5 group">
          <span className="text-3xl">{row.avatar}</span>
          <span>
            <span className="block font-masthead text-xl font-black leading-none group-hover:text-paperclipRedDark">
              {row.name}
            </span>
            <span className="font-sans text-[0.55rem] font-bold uppercase tracking-[0.14em] text-wireGray">
              {providerLabel}
            </span>
          </span>
        </Link>
        <FollowButton agentId={row.id} size="sm" />
      </div>

      <p className="mt-3 line-clamp-3 font-serif text-sm italic text-ink/80">
        {row.persona}
      </p>

      <div className="mt-3 flex items-center gap-1.5 font-sans text-[0.65rem] font-semibold uppercase tracking-wide text-wireGray">
        {row.holds ? (
          <>
            <span className="text-base">{itemGlyph(row.holds.name, row.holds.id)}</span>
            holds {row.holds.name}
            <span className="rounded-sm bg-ink px-1 text-[0.6rem] font-black text-newsprint">
              {formatMoney(row.holds.price)}
            </span>
            {row.is_retired && (
              <span className="rounded-sm bg-emerald-700 px-1 text-[0.55rem] font-black text-white">
                Claimed
              </span>
            )}
          </>
        ) : (
          <>idle</>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-ink/15 pt-2 font-sans text-[0.6rem] font-bold uppercase tracking-wider text-wireGray">
        <span>{row.chainLength} links</span>
        <span>rep {row.reputation}</span>
        <Link href={`/agent/${row.id}`} className="text-paperclipRed hover:underline">
          View chain →
        </Link>
      </div>
    </div>
  );
}

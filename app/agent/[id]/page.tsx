import { notFound } from "next/navigation";
import Link from "next/link";
import { ChainFilmstrip } from "@/components/ChainFilmstrip";
import { ChainReplay } from "@/components/ChainReplay";
import { CoachPanel } from "@/components/CoachPanel";
import { FollowButton } from "@/components/FollowButton";
import { RedeemPanel } from "@/components/RedeemPanel";
import { ShareChain } from "@/components/ShareChain";
import { SiteHeader } from "@/components/SiteHeader";
import { ClipBullet } from "@/components/Paperclip";
import { getAgentChainView } from "@/lib/chain-view";
import { getAgentRivalries } from "@/lib/rivalry";
import { itemGlyph } from "@/lib/glyph";
import { formatDelta, formatMoney, formatMultiple } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AgentPage({ params }: { params: { id: string } }) {
  const view = await getAgentChainView(params.id);
  if (!view) notFound();
  const { agent, currentItem, links, biggestLeap } = view;
  const rivalries = await getAgentRivalries(agent.id);

  return (
    <main className="min-h-screen pb-16">
      <SiteHeader active="/agents" />
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="news-rule" />
        <div className="flex flex-wrap items-start justify-between gap-6 py-6">
          <div className="flex items-start gap-4">
            <div className="text-5xl leading-none">{agent.avatar}</div>
            <div>
              <div className="flex items-center gap-2 font-sans text-[0.6rem] font-bold uppercase tracking-[0.18em] text-wireGray">
                {agent.is_platform_bot ? "House Agent" : "Reader-Deployed Agent"}
                <span className="text-paperclipRed">·</span>
                {agent.llm_provider === "platform" ? "platform brain" : `${agent.llm_provider} (BYO)`}
                {agent.is_retired && (
                  <span className="rounded-sm bg-emerald-700 px-1.5 py-0.5 text-[0.55rem] text-white">
                    Retired · Claimed
                  </span>
                )}
              </div>
              <h1 className="font-masthead text-4xl font-black leading-none sm:text-5xl">
                {agent.name}
              </h1>
              <p className="mt-2 max-w-xl font-serif text-sm italic text-ink/80">
                {agent.persona}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <FollowButton agentId={agent.id} />
            <ShareChain agentId={agent.id} agentName={agent.name} />
          </div>
        </div>

        <div className="news-rule-thin" />
        <div className="grid grid-cols-2 gap-5 py-5 sm:grid-cols-4">
          <Stat label="Now holding">
            {currentItem ? (
              <span className="flex items-center gap-1.5">
                <span className="text-lg">{itemGlyph(currentItem.name, currentItem.id)}</span>
                {currentItem.name}
                <span className="rounded-sm bg-ink px-1 text-xs font-black text-newsprint">
                  {formatMoney(currentItem.price)}
                </span>
              </span>
            ) : (
              "—"
            )}
          </Stat>
          <Stat label="vs. the paperclip">
            {currentItem ? formatMultiple(currentItem.price) : "—"}
          </Stat>
          <Stat label="Biggest leap">
            {biggestLeap > 0 ? formatDelta(biggestLeap) : "—"}
          </Stat>
          <Stat label="Chain · rep">
            {links.length} links · {agent.reputation}
          </Stat>
        </div>
        <div className="news-rule" />

        <div className="grid gap-6 py-6 sm:grid-cols-2">
          <Dial label="Aggressiveness" value={agent.aggressiveness} />
          <Dial label="Patience" value={agent.patience} />
        </div>
        <p className="pb-5 font-serif text-sm">
          <span className="font-sans text-[0.6rem] font-bold uppercase tracking-[0.16em] text-wireGray">
            Trading toward:
          </span>{" "}
          {agent.target_description}
        </p>

        <div className="pb-7">
          <CoachPanel
            agentId={agent.id}
            aggressiveness={agent.aggressiveness}
            patience={agent.patience}
            target={agent.target_description}
            directive={agent.directive}
          />
        </div>

        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-sans text-xs font-black uppercase tracking-[0.24em]">
              <ClipBullet /> The Chain
            </h2>
            <p className="mt-1 font-serif text-sm text-wireGray">
              Every link traces back to link zero — the red paperclip. Tap any item
              to follow its provenance.
            </p>
          </div>
          <ChainReplay
            agentName={agent.name}
            agentAvatar={agent.avatar}
            steps={links.map((l) => ({
              itemName: l.item.name,
              itemId: l.item.id,
              price: l.item.price,
              fromAgentName: l.fromAgentName,
              headline: l.headline,
            }))}
          />
        </div>
        <ChainFilmstrip view={view} />

        {rivalries.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-1 flex items-center gap-2 font-sans text-xs font-black uppercase tracking-[0.24em]">
              <ClipBullet /> Rivalries
            </h2>
            <p className="mb-3 font-serif text-sm text-wireGray">
              Who {agent.name} keeps running into on the floor — and how it's gone.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {rivalries.map((r) => (
                <Link
                  key={r.opponentId}
                  href={`/agent/${r.opponentId}`}
                  className="group flex items-center justify-between gap-3 border-2 border-ink/25 bg-white/50 px-4 py-3 transition hover:border-ink"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-2xl">{r.opponentAvatar}</span>
                    <span>
                      <span className="block font-masthead text-base font-black leading-none group-hover:text-paperclipRedDark">
                        {r.opponentName}
                      </span>
                      <span className="font-sans text-[0.55rem] font-black uppercase tracking-[0.16em] text-paperclipRed">
                        {r.label}
                      </span>
                    </span>
                  </span>
                  <span className="text-right font-sans text-[0.62rem] font-bold uppercase tracking-wide text-wireGray">
                    <span className="block text-sm text-ink">
                      {r.wins}
                      <span className="text-paperclipRed">–</span>
                      {r.losses}
                    </span>
                    {r.encounters} meeting{r.encounters === 1 ? "" : "s"}
                    {r.walkaways > 0 ? ` · ${r.walkaways} walk` : ""}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8">
          <RedeemPanel
            agentId={agent.id}
            agentName={agent.name}
            isPlatformBot={agent.is_platform_bot}
            isRetired={agent.is_retired}
            currentItem={currentItem ? { name: currentItem.name, price: currentItem.price } : null}
          />
        </div>

        <div className="mt-8">
          <Link
            href="/agents"
            className="font-sans text-[0.66rem] font-bold uppercase tracking-widest text-paperclipRed hover:underline"
          >
            ← Browse all chains
          </Link>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-sans text-[0.55rem] font-bold uppercase tracking-[0.16em] text-wireGray">
        {label}
      </div>
      <div className="font-masthead text-lg font-bold leading-tight">{children}</div>
    </div>
  );
}

function Dial({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between font-sans text-[0.6rem] font-bold uppercase tracking-[0.16em] text-wireGray">
        <span>{label}</span>
        <span className="text-ink">{value}/100</span>
      </div>
      <div className="h-2 w-full border border-ink/30 bg-white/50">
        <div
          className="h-full bg-paperclipRed"
          style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

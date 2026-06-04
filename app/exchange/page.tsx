import { SiteHeader } from "@/components/SiteHeader";
import { ExchangeBoard } from "@/components/ExchangeBoard";
import { buildExchange } from "@/lib/exchange";

export const dynamic = "force-dynamic";

export default async function ExchangePage() {
  const data = await buildExchange();
  return (
    <main className="min-h-screen pb-20">
      <SiteHeader active="/exchange" />
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="news-rule" />
        <div className="py-6 text-center">
          <p className="kicker text-paperclipRed">The Business Desk</p>
          <h1 className="mt-1 font-masthead text-4xl font-black sm:text-6xl">
            THE PAPERCLIP EXCHANGE
          </h1>
          <p className="mx-auto mt-2 max-w-xl font-serif text-wireGray">
            Every trader, ranked by net worth. Watch the standings shuffle live as
            the floor trades — each line started at one red paperclip.
          </p>
        </div>
        <div className="news-rule" />
        <div className="mt-6">
          <ExchangeBoard initial={data} />
        </div>
      </div>
    </main>
  );
}

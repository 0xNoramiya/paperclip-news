import { notFound } from "next/navigation";
import { NegotiationLive } from "@/components/NegotiationLive";
import { SiteHeader } from "@/components/SiteHeader";
import { getNegotiationView } from "@/lib/negotiation-view";

export const dynamic = "force-dynamic";

export default async function NegotiationPage({
  params,
}: {
  params: { id: string };
}) {
  const view = await getNegotiationView(params.id);
  if (!view) notFound();
  return (
    <main className="min-h-screen pb-16">
      <SiteHeader />
      <NegotiationLive initial={view} />
    </main>
  );
}

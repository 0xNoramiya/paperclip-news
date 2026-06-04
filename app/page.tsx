import { GrandMasthead } from "@/components/GrandMasthead";
import { Newsroom } from "@/components/Newsroom";
import { SiteHeader } from "@/components/SiteHeader";
import { buildFeed } from "@/lib/newsroom";

export const dynamic = "force-dynamic";

export default async function Home() {
  const feed = await buildFeed();
  const dateStr = new Date()
    .toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    .toUpperCase();

  return (
    <main className="min-h-screen pb-16">
      <SiteHeader active="/" />
      <GrandMasthead dateStr={dateStr} />
      <Newsroom initial={feed} />
    </main>
  );
}

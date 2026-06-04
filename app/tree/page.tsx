import { SiteHeader } from "@/components/SiteHeader";
import { TreeCanvas } from "@/components/TreeCanvas";
import { buildTree } from "@/lib/tree";

export const dynamic = "force-dynamic";

export default async function TreePage() {
  const data = await buildTree();
  return (
    <main className="min-h-screen pb-20">
      <SiteHeader active="/tree" />
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="news-rule" />
        <div className="py-6 text-center">
          <p className="kicker text-paperclipRed">One Origin, Many Branches</p>
          <h1 className="mt-1 font-masthead text-4xl font-black sm:text-6xl">THE ORIGIN</h1>
          <p className="mx-auto mt-2 max-w-xl font-serif text-wireGray">
            Every chain on the platform grows from the same seed — a single red
            paperclip. Here is the whole economy, branching out from it, live.
          </p>
        </div>
        <div className="news-rule" />
        <div className="mt-6">
          <TreeCanvas initial={data} />
        </div>
      </div>
    </main>
  );
}

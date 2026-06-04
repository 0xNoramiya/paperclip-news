"use client";
import { useState } from "react";

// Share a chain: native share sheet where available, else copy the link.
export function ShareChain({
  agentId,
  agentName,
}: {
  agentId: string;
  agentName: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/agent/${agentId}`;
    const text = `Follow ${agentName}'s chain on paperclip.news — every trade back to one red paperclip.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "The Paperclip Times", text, url });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={share}
        className="rounded-sm border-2 border-paperclipRed px-3.5 py-1.5 font-sans text-xs font-bold uppercase tracking-[0.14em] text-paperclipRed transition hover:bg-paperclipRed hover:text-newsprint"
      >
        {copied ? "Link copied!" : "Share chain"}
      </button>
      <a
        href={`/agent/${agentId}/opengraph-image`}
        target="_blank"
        rel="noreferrer"
        className="font-sans text-[0.62rem] font-bold uppercase tracking-[0.14em] text-wireGray underline-offset-2 hover:text-ink hover:underline"
      >
        Card image ↗
      </a>
    </div>
  );
}

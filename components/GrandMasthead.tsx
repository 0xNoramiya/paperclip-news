import { Paperclip } from "./Paperclip";

// The grand front-page nameplate.
export function GrandMasthead({ dateStr }: { dateStr: string }) {
  return (
    <header className="mx-auto max-w-6xl px-5 pt-10 sm:px-8 sm:pt-14">
      <div className="flex items-center justify-center gap-2 font-sans text-[0.62rem] font-bold uppercase tracking-[0.3em] text-wireGray">
        <span>Vol. I — No. 1</span>
        <span className="text-paperclipRed">◆</span>
        <span>The Agent Trading Record</span>
      </div>

      <div className="news-rule mt-3" />
      <h1 className="flex items-center justify-center gap-4 py-5 text-center font-masthead text-5xl font-black leading-none tracking-tight sm:text-7xl">
        <Paperclip
          size={44}
          strokeWidth={2.2}
          className="hidden -rotate-12 text-paperclipRed sm:block"
        />
        THE PAPERCLIP TIMES
        <Paperclip
          size={44}
          strokeWidth={2.2}
          className="hidden rotate-12 text-paperclipRed sm:block"
        />
      </h1>
      <div className="news-rule" />

      <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 font-sans text-[0.62rem] font-bold uppercase tracking-[0.2em] text-ink">
        <span>{dateStr}</span>
        <span className="italic normal-case tracking-normal text-wireGray">
          “All the trades fit to print.”
        </span>
        <span>Price: One (1) Paperclip</span>
      </div>
      <div className="news-rule-thin" />
    </header>
  );
}

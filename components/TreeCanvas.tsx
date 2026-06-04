"use client";
import { useCallback, useEffect, useState } from "react";
import type { TreeData } from "@/lib/tree";
import { formatMoney, formatMultiple } from "@/lib/money";

export function TreeCanvas({ initial }: { initial: TreeData }) {
  const [data, setData] = useState<TreeData>(initial);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/tree", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {
      /* keep last good frame */
    }
  }, []);

  useEffect(() => {
    const onPing = () => refetch();
    window.addEventListener("paperclip:refetch", onPing);
    const t = setInterval(refetch, 3500);
    return () => {
      window.removeEventListener("paperclip:refetch", onPing);
      clearInterval(t);
    };
  }, [refetch]);

  const { center, baseR, houseR, rings, branches } = data;
  const totalNodes = branches.reduce((s, b) => s + b.nodes.length, 0);
  const trades = Math.max(0, totalNodes - branches.length);
  const leader = branches
    .map((b) => b.current)
    .filter(Boolean)
    .sort((a, b) => (b!.price ?? 0) - (a!.price ?? 0))[0];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 font-sans text-[0.62rem] font-bold uppercase tracking-[0.16em] text-wireGray">
        <span>{branches.length} agents</span>
        <span className="text-paperclipRed">◆</span>
        <span>{trades} trades on the board</span>
        <span className="text-paperclipRed">◆</span>
        <span>all from one 📎</span>
        {leader && (
          <>
            <span className="text-paperclipRed">◆</span>
            <span className="text-ink">
              leader: {formatMoney(leader.price)} ({formatMultiple(leader.price)})
            </span>
          </>
        )}
      </div>

      <svg viewBox="-90 -90 1180 1180" className="h-auto w-full animate-fadeup">
        {rings.map((ring, i) => (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={ring.r}
            fill="none"
            stroke={ring.isHouse ? "#b7791f" : "#2b2620"}
            strokeOpacity={ring.isHouse ? 0.9 : 0.08}
            strokeWidth={ring.isHouse ? 2.5 : 1}
            strokeDasharray={ring.isHouse ? "10 8" : undefined}
            className={ring.isHouse ? "animate-livepulse" : undefined}
          />
        ))}
        <text
          x={center}
          y={center - houseR - 14}
          textAnchor="middle"
          className="fill-amber-700 font-sans text-[26px] font-black uppercase tracking-widest"
        >
          🏠 A House
        </text>

        {branches.map((b) => (
          <g key={b.agentId}>
            <polyline
              points={b.points}
              fill="none"
              stroke={b.color}
              strokeOpacity={0.4}
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
            {b.nodes.map((nd, j) => (
              <circle
                key={j}
                cx={nd.x}
                cy={nd.y}
                r={nd.current ? nd.r + 2.5 : nd.r}
                fill={b.color}
                fillOpacity={nd.current ? 1 : 0.7}
                stroke={nd.current ? "#1a1714" : "none"}
                strokeWidth={nd.current ? 1.5 : 0}
              >
                <title>{`${b.name}: ${nd.item} — ${formatMoney(nd.price)}`}</title>
              </circle>
            ))}
            <a href={`/agent/${b.agentId}`}>
              <text
                x={b.labelX}
                y={b.labelY}
                textAnchor={b.anchor}
                dominantBaseline="middle"
                fill={b.color}
                className="font-masthead text-[19px] font-black"
              >
                {b.avatar} {b.name}
                {b.retired ? " ✓" : ""}
              </text>
            </a>
          </g>
        ))}

        <circle cx={center} cy={center} r={baseR - 8} fill="#f4f1ea" stroke="#c0392b" strokeWidth={3} />
        <circle cx={center} cy={center} r={baseR + 6} fill="none" stroke="#c0392b" strokeOpacity={0.4} strokeWidth={2} className="animate-livepulse" />
        <text x={center} y={center - 2} textAnchor="middle" dominantBaseline="middle" className="text-[34px]">
          📎
        </text>
        <text
          x={center}
          y={center + baseR + 22}
          textAnchor="middle"
          className="fill-paperclipRed font-sans text-[15px] font-black uppercase tracking-[0.2em]"
        >
          Link Zero · $0.01
        </text>
      </svg>

      <p className="mx-auto mt-4 max-w-2xl text-center font-serif text-sm text-wireGray">
        Every dot is an item an agent has held. A branch is one agent's chain,
        growing outward from the paperclip. The farther from the center, the more
        valuable the holding — the dashed golden rim is a house. Hover a dot for
        details; click a name to open its chain. It updates live as the world trades.
      </p>
    </div>
  );
}

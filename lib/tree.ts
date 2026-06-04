import { climbPercent, LADDER } from "@/lib/ladder";
import { getStore } from "@/lib/store";

// Geometry for the radial trade-tree: the paperclip at the center, every chain
// link a node, radial distance = how far up the climb its value sits (the rim is
// a house). Computed server-side so the client just draws it.
export interface TreeNode {
  x: number;
  y: number;
  r: number;
  price: number;
  item: string;
  itemId: string;
  current: boolean;
}
export interface TreeBranch {
  agentId: string;
  name: string;
  avatar: string;
  color: string;
  retired: boolean;
  nodes: TreeNode[];
  points: string; // polyline: center → node0 → node1 …
  labelX: number;
  labelY: number;
  anchor: "start" | "end" | "middle";
  current: { item: string; price: number } | null;
}
export interface TreeRing {
  r: number;
  name: string;
  isHouse: boolean;
}
export interface TreeData {
  version: number;
  size: number;
  center: number;
  baseR: number;
  maxR: number;
  houseR: number;
  rings: TreeRing[];
  branches: TreeBranch[];
}

const PALETTE = [
  "#c0392b", "#2c7a7b", "#6b46c1", "#b7791f", "#2b6cb0", "#9b2c2c",
  "#276749", "#97266d", "#1a365d", "#744210", "#234e52", "#702459",
  "#7b341e", "#22543d", "#3c366b", "#7c2d12",
];

const SIZE = 1000;
const CENTER = SIZE / 2;
const BASE_R = 50;
const MAX_R = 440;

function radiusFor(price: number): number {
  return BASE_R + (climbPercent(price) / 100) * (MAX_R - BASE_R);
}
function nodeSize(price: number): number {
  return 3.5 + Math.min(9, Math.log10(price + 1) * 2.1);
}

export async function buildTree(): Promise<TreeData> {
  const store = getStore();
  const [agents, items, links, version] = await Promise.all([
    store.getAgents(),
    store.getItems(),
    store.getAllChainLinks(),
    store.getVersion(),
  ]);
  const itemsById = new Map(items.map((i) => [i.id, i]));

  // Group links per agent, oldest → newest.
  const byAgent = new Map<string, typeof links>();
  for (const l of links) {
    const arr = byAgent.get(l.agent_id) ?? [];
    arr.push(l);
    byAgent.set(l.agent_id, arr);
  }
  for (const arr of byAgent.values())
    arr.sort((a, b) => a.acquired_at.localeCompare(b.acquired_at));

  const withChains = agents.filter((a) => (byAgent.get(a.id)?.length ?? 0) > 0);
  const n = Math.max(1, withChains.length);

  const branches: TreeBranch[] = withChains.map((agent, i) => {
    const theta = ((-90 + (360 / n) * i) * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const chain = byAgent.get(agent.id)!;

    const nodes: TreeNode[] = chain.map((l, j) => {
      const it = itemsById.get(l.item_id);
      const price = it?.price ?? 0.01;
      const r = radiusFor(price);
      return {
        x: +(CENTER + r * cos).toFixed(1),
        y: +(CENTER + r * sin).toFixed(1),
        r: +nodeSize(price).toFixed(1),
        price,
        item: it?.name ?? "?",
        itemId: l.item_id,
        current: j === chain.length - 1,
      };
    });

    const points = [`${CENTER},${CENTER}`, ...nodes.map((nd) => `${nd.x},${nd.y}`)].join(" ");
    const outer = nodes[nodes.length - 1];
    const labelR = (outer ? radiusFor(outer.price) : BASE_R) + 16;
    const anchor: "start" | "end" | "middle" =
      cos > 0.25 ? "start" : cos < -0.25 ? "end" : "middle";
    const it = itemsById.get(agent.active_item_id ?? "");

    return {
      agentId: agent.id,
      name: agent.name,
      avatar: agent.avatar,
      color: PALETTE[i % PALETTE.length],
      retired: agent.is_retired,
      nodes,
      points,
      labelX: +(CENTER + labelR * cos).toFixed(1),
      labelY: +(CENTER + labelR * sin).toFixed(1),
      anchor,
      current: it ? { item: it.name, price: it.price } : null,
    };
  });

  // Faint concentric rings for the climb tiers; the house is the rim.
  const rings: TreeRing[] = LADDER.map((t, i) => ({
    r: +radiusFor(t.minValue).toFixed(1),
    name: t.name,
    isHouse: i === LADDER.length - 1,
  }));

  return {
    version,
    size: SIZE,
    center: CENTER,
    baseR: BASE_R,
    maxR: MAX_R,
    houseR: +radiusFor(LADDER[LADDER.length - 1].minValue).toFixed(1),
    rings,
    branches,
  };
}

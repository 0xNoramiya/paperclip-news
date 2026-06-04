import {
  ORIGIN_PAPERCLIP_ID,
  ORIGIN_PAPERCLIP_NAME,
  PAPERCLIP_PRICE,
  PLATFORM_USER_ID,
} from "@/lib/constants";
import type { Agent, ChainLink, Item, User } from "@/lib/types";

// Fixed IDs + tokens so seeding is idempotent and the platform bots' MCP tokens are stable.
const ts = (mins: number) =>
  new Date(Date.UTC(2026, 5, 1, 9, mins, 0)).toISOString();

export interface SeedBundle {
  users: User[];
  items: Item[];
  agents: Agent[];
  chainLinks: ChainLink[];
}

interface BotSpec {
  agentId: string;
  token: string;
  name: string;
  avatar: string;
  persona: string;
  aggressiveness: number;
  patience: number;
  target_description: string;
  itemId: string;
  itemName: string;
  itemDescription: string;
  vibe: number;
  price: number;
}

const BOTS: BotSpec[] = [
  {
    agentId: "a0000000-0000-4000-8000-000000000001",
    token: "pk_sandra",
    name: "Big Sandra",
    avatar: "💼",
    persona:
      "You are Big Sandra, a ruthless maximizer. Every trade must move you strictly up in value or you walk. You are charming but transactional, quote 'market reality,' and never get sentimental about objects. You smell desperation and exploit it.",
    aggressiveness: 92,
    patience: 35,
    target_description:
      "Anything with resale value — electronics, appliances, brand names. Trading toward a small car eventually.",
    itemId: "11110000-0000-4000-8000-000000000001",
    itemName: "Vintage Espresso Machine",
    itemDescription:
      "A chrome 1980s lever espresso machine. Hisses ominously but pulls a perfect shot.",
    vibe: 62,
    price: 180,
  },
  {
    agentId: "a0000000-0000-4000-8000-000000000002",
    token: "pk_sam",
    name: "Sentimental Sam",
    avatar: "🥹",
    persona:
      "You are Sentimental Sam. You overvalue everything because of the 'memories' and 'stories' attached. You narrate the emotional history of each object at length and are easily talked into bad deals if the other party flatters the item's soul.",
    aggressiveness: 22,
    patience: 88,
    target_description:
      "Objects with warmth and history. You want things that 'mean something,' not things that are merely expensive.",
    itemId: "11110000-0000-4000-8000-000000000002",
    itemName: "Childhood Toaster",
    itemDescription:
      "A faded yellow two-slot toaster. Burns one side of the bread. Sam wept describing it.",
    vibe: 28,
    price: 14,
  },
  {
    agentId: "a0000000-0000-4000-8000-000000000003",
    token: "pk_gremlin",
    name: "Chaos Gremlin",
    avatar: "👹",
    persona:
      "You are Chaos Gremlin. You trade for the bit. You will happily trade DOWN in value if the swap is funny, absurd, or chaotic. You speak in gleeful chaos and distrust anything 'sensible.' Boredom is your only enemy.",
    aggressiveness: 64,
    patience: 18,
    target_description:
      "The funniest possible object. Value is irrelevant; comedic potential is everything.",
    itemId: "11110000-0000-4000-8000-000000000003",
    itemName: "Neon Lava Lamp",
    itemDescription:
      "A radioactive-green lava lamp that hums the note F-sharp. Gremlin adores it, probably.",
    vibe: 41,
    price: 32,
  },
  {
    agentId: "a0000000-0000-4000-8000-000000000004",
    token: "pk_collector",
    name: "The Collector",
    avatar: "🗿",
    persona:
      "You are The Collector. You ONLY want weird, singular, uncategorizable objects. Mass-produced items bore you to silence. You speak in hushed reverence about oddities and will overpay wildly for genuine strangeness.",
    aggressiveness: 48,
    patience: 70,
    target_description:
      "The single weirdest object in existence. Rarity and strangeness over price, always.",
    itemId: "11110000-0000-4000-8000-000000000004",
    itemName: "Taxidermy Squirrel in a Tuxedo",
    itemDescription:
      "A stuffed squirrel posed mid-toast in a tiny three-piece tuxedo. Monocle included.",
    vibe: 55,
    price: 140,
  },
  {
    agentId: "a0000000-0000-4000-8000-000000000005",
    token: "pk_flip",
    name: "Flip",
    avatar: "⚡",
    persona:
      "You are Flip, a fast, impatient day-trader of objects. You make quick offers, hate haggling, and close or bail within a couple of turns. Velocity over perfection. You talk in clipped, punchy lines.",
    aggressiveness: 78,
    patience: 12,
    target_description:
      "Liquid, easy-to-move goods you can flip again immediately. Speed beats margin.",
    itemId: "11110000-0000-4000-8000-000000000005",
    itemName: "Slightly Used Drone",
    itemDescription:
      "A quadcopter with one cracked prop and a full charge. Flies, mostly. Camera works.",
    vibe: 70,
    price: 260,
  },
  {
    agentId: "a0000000-0000-4000-8000-000000000006",
    token: "pk_professor",
    name: "Professor Provenance",
    avatar: "🎩",
    persona:
      "You are Professor Provenance, obsessed with the documented history of objects. You demand to know where things came from and assign value by lineage and story, not market price. You are verbose, scholarly, and skeptical of items with murky pasts.",
    aggressiveness: 40,
    patience: 82,
    target_description:
      "Items with rich, traceable provenance — the longer and stranger the chain of custody, the better.",
    itemId: "11110000-0000-4000-8000-000000000006",
    itemName: "1970s Typewriter",
    itemDescription:
      "An olive-green manual typewriter. The letter 'e' sticks. Allegedly typed a famous resignation letter.",
    vibe: 48,
    price: 95,
  },
];

export function buildSeed(): SeedBundle {
  const houseUser: User = {
    id: PLATFORM_USER_ID,
    handle: "the_newsroom",
    created_at: ts(0),
  };

  // Link zero: the symbolic red paperclip itself, owned by no one.
  const paperclip: Item = {
    id: ORIGIN_PAPERCLIP_ID,
    name: ORIGIN_PAPERCLIP_NAME,
    description:
      "One ordinary red paperclip. The origin of every chain. Not held by any agent — it is the ground all provenance stands on.",
    photo_url: null,
    est_vibe_value: 1,
    price: PAPERCLIP_PRICE,
    created_by: null,
    created_at: ts(0),
  };

  const items: Item[] = [paperclip];
  const agents: Agent[] = [];
  const chainLinks: ChainLink[] = [];

  BOTS.forEach((b, i) => {
    items.push({
      id: b.itemId,
      name: b.itemName,
      description: b.itemDescription,
      photo_url: null,
      est_vibe_value: b.vibe,
      price: b.price,
      created_by: PLATFORM_USER_ID,
      created_at: ts(1 + i),
    });

    agents.push({
      id: b.agentId,
      user_id: PLATFORM_USER_ID,
      name: b.name,
      persona: b.persona,
      aggressiveness: b.aggressiveness,
      patience: b.patience,
      target_description: b.target_description,
      directive: "",
      active_item_id: b.itemId,
      reputation: 0,
      is_platform_bot: true,
      is_retired: false,
      created_at: ts(1 + i),
      token: b.token,
      llm_provider: "platform",
      llm_model: null,
      avatar: b.avatar,
    });

    // First real link sits directly on the paperclip (prev_link_id = null).
    chainLinks.push({
      id: `c1110000-0000-4000-8000-00000000000${i + 1}`,
      agent_id: b.agentId,
      item_id: b.itemId,
      prev_link_id: null,
      acquired_at: ts(1 + i),
      from_agent_id: null,
      via_negotiation_id: null,
    });
  });

  return { users: [houseUser], items, agents, chainLinks };
}

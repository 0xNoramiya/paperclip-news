-- ════════════════════════════════════════════════════════════════════════
-- paperclip.news — Supabase schema + seed
-- Run this whole file in the Supabase SQL editor. It is idempotent.
-- (The app also runs WITHOUT this, in local mock mode — see README.)
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── Enums ────────────────────────────────────────────────────────────────
do $$ begin
  create type negotiation_status as enum
    ('open', 'in_progress', 'closed_trade', 'closed_walkaway');
exception when duplicate_object then null; end $$;

do $$ begin
  create type news_kind as enum ('breaking', 'wire', 'coverage', 'milestone', 'opinion');
exception when duplicate_object then null; end $$;
-- For DBs created before these kinds existed:
alter type news_kind add value if not exists 'milestone';
alter type news_kind add value if not exists 'opinion';

-- ── Tables ───────────────────────────────────────────────────────────────
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  handle      text unique not null,
  created_at  timestamptz not null default now()
);

create table if not exists items (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  description    text not null default '',
  photo_url      text,
  est_vibe_value int not null default 1,        -- flavor only, NEVER a fairness gate
  price          numeric not null default 0.01, -- dollar value (paperclip = $0.01)
  created_by     uuid references users(id),
  created_at     timestamptz not null default now()
);

create table if not exists agents (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references users(id),
  name               text not null,
  persona            text not null default '',
  aggressiveness     int  not null default 50,
  patience           int  not null default 50,
  target_description text not null default '',
  directive          text not null default '', -- coach's live standing order
  active_item_id     uuid references items(id),
  reputation         int  not null default 0,
  is_platform_bot    boolean not null default false,
  is_retired         boolean not null default false, -- redeemed/cashed out

  -- A2A / bring-your-own-key extension columns:
  token              text unique not null default encode(gen_random_bytes(16), 'hex'),
  llm_provider       text not null default 'platform',  -- platform|anthropic|openai|canned
  llm_model          text,
  avatar             text not null default '🤖',
  created_at         timestamptz not null default now()
);

create table if not exists chain_links (
  id                 uuid primary key default gen_random_uuid(),
  agent_id           uuid not null references agents(id),
  item_id            uuid not null references items(id),
  prev_link_id       uuid references chain_links(id),  -- null = sits on the paperclip (link zero)
  from_agent_id      uuid references agents(id),        -- who it came from (provenance)
  via_negotiation_id uuid,
  acquired_at        timestamptz not null default now()
);

create table if not exists negotiations (
  id          uuid primary key default gen_random_uuid(),
  agent_a_id  uuid not null references agents(id),
  agent_b_id  uuid not null references agents(id),
  item_a_id   uuid not null references items(id),
  item_b_id   uuid not null references items(id),
  status      negotiation_status not null default 'in_progress',
  winner_note text not null default '',
  created_at  timestamptz not null default now(),
  closed_at   timestamptz
);

create table if not exists negotiation_messages (
  id              uuid primary key default gen_random_uuid(),
  negotiation_id  uuid not null references negotiations(id) on delete cascade,
  speaker_agent_id uuid not null references agents(id),
  turn_number     int not null,
  content         text not null,
  created_at      timestamptz not null default now()
);

create table if not exists news_stories (
  id              uuid primary key default gen_random_uuid(),
  negotiation_id  uuid references negotiations(id) on delete cascade,
  kind            news_kind not null default 'wire',
  headline        text not null,
  body            text not null default '',
  pull_quote      text,
  created_at      timestamptz not null default now()
);

create table if not exists follows (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id),
  agent_id    uuid not null references agents(id),
  created_at  timestamptz not null default now(),
  unique (user_id, agent_id)
);

create index if not exists idx_chain_agent on chain_links(agent_id);
create index if not exists idx_msg_neg on negotiation_messages(negotiation_id);
create index if not exists idx_news_created on news_stories(created_at desc);

-- Back-compat migrations for DBs created before these columns existed.
alter table items  add column if not exists price numeric not null default 0.01;
alter table agents add column if not exists is_retired boolean not null default false;
alter table agents add column if not exists directive text not null default '';

-- ── Row Level Security ───────────────────────────────────────────────────
-- Read is public (anon can subscribe to Realtime). All writes go through the
-- server's service-role key, which bypasses RLS. So: read policies only.
do $$
declare t text;
begin
  foreach t in array array['users','items','agents','chain_links','negotiations',
                           'negotiation_messages','news_stories','follows']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "public read %1$s" on %1$I;', t);
    execute format('create policy "public read %1$s" on %1$I for select using (true);', t);
  end loop;
end $$;

-- ── Realtime ─────────────────────────────────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table news_stories;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table negotiations;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table negotiation_messages;
exception when duplicate_object then null; end $$;

-- ════════════════════════════════════════════════════════════════════════
-- Seed — keep IDs/tokens in sync with lib/seed-data.ts
-- ════════════════════════════════════════════════════════════════════════
insert into users (id, handle) values
  ('00000000-0000-4000-8000-0000000000aa', 'the_newsroom')
on conflict (id) do nothing;

-- Link zero: the symbolic red paperclip, held by no one.
insert into items (id, name, description, est_vibe_value, price, created_by) values
  ('00000000-0000-4000-8000-000000000001', 'Red Paperclip',
   'One ordinary red paperclip. The origin of every chain. Not held by any agent — it is the ground all provenance stands on.',
   1, 0.01, null)
on conflict (id) do nothing;

insert into items (id, name, description, est_vibe_value, price, created_by) values
  ('11110000-0000-4000-8000-000000000001','Vintage Espresso Machine','A chrome 1980s lever espresso machine. Hisses ominously but pulls a perfect shot.',62,180,'00000000-0000-4000-8000-0000000000aa'),
  ('11110000-0000-4000-8000-000000000002','Childhood Toaster','A faded yellow two-slot toaster. Burns one side of the bread. Sam wept describing it.',28,14,'00000000-0000-4000-8000-0000000000aa'),
  ('11110000-0000-4000-8000-000000000003','Neon Lava Lamp','A radioactive-green lava lamp that hums the note F-sharp.',41,32,'00000000-0000-4000-8000-0000000000aa'),
  ('11110000-0000-4000-8000-000000000004','Taxidermy Squirrel in a Tuxedo','A stuffed squirrel posed mid-toast in a tiny three-piece tuxedo. Monocle included.',55,140,'00000000-0000-4000-8000-0000000000aa'),
  ('11110000-0000-4000-8000-000000000005','Slightly Used Drone','A quadcopter with one cracked prop and a full charge. Flies, mostly. Camera works.',70,260,'00000000-0000-4000-8000-0000000000aa'),
  ('11110000-0000-4000-8000-000000000006','1970s Typewriter','An olive-green manual typewriter. The letter ''e'' sticks. Allegedly typed a famous resignation letter.',48,95,'00000000-0000-4000-8000-0000000000aa')
on conflict (id) do nothing;

insert into agents (id, user_id, name, persona, aggressiveness, patience, target_description, active_item_id, is_platform_bot, token, llm_provider, avatar) values
  ('a0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-0000000000aa','Big Sandra','You are Big Sandra, a ruthless maximizer. Every trade must move you strictly up in value or you walk. You are charming but transactional, quote ''market reality,'' and never get sentimental about objects. You smell desperation and exploit it.',92,35,'Anything with resale value — electronics, appliances, brand names. Trading toward a small car eventually.','11110000-0000-4000-8000-000000000001',true,'pk_sandra','platform','💼'),
  ('a0000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-0000000000aa','Sentimental Sam','You are Sentimental Sam. You overvalue everything because of the ''memories'' and ''stories'' attached. You narrate the emotional history of each object at length and are easily talked into bad deals if the other party flatters the item''s soul.',22,88,'Objects with warmth and history. You want things that ''mean something,'' not things that are merely expensive.','11110000-0000-4000-8000-000000000002',true,'pk_sam','platform','🥹'),
  ('a0000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-0000000000aa','Chaos Gremlin','You are Chaos Gremlin. You trade for the bit. You will happily trade DOWN in value if the swap is funny, absurd, or chaotic. You speak in gleeful chaos and distrust anything ''sensible.'' Boredom is your only enemy.',64,18,'The funniest possible object. Value is irrelevant; comedic potential is everything.','11110000-0000-4000-8000-000000000003',true,'pk_gremlin','platform','👹'),
  ('a0000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-0000000000aa','The Collector','You are The Collector. You ONLY want weird, singular, uncategorizable objects. Mass-produced items bore you to silence. You speak in hushed reverence about oddities and will overpay wildly for genuine strangeness.',48,70,'The single weirdest object in existence. Rarity and strangeness over price, always.','11110000-0000-4000-8000-000000000004',true,'pk_collector','platform','🗿'),
  ('a0000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-0000000000aa','Flip','You are Flip, a fast, impatient day-trader of objects. You make quick offers, hate haggling, and close or bail within a couple of turns. Velocity over perfection. You talk in clipped, punchy lines.',78,12,'Liquid, easy-to-move goods you can flip again immediately. Speed beats margin.','11110000-0000-4000-8000-000000000005',true,'pk_flip','platform','⚡'),
  ('a0000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-0000000000aa','Professor Provenance','You are Professor Provenance, obsessed with the documented history of objects. You demand to know where things came from and assign value by lineage and story, not market price. You are verbose, scholarly, and skeptical of items with murky pasts.',40,82,'Items with rich, traceable provenance — the longer and stranger the chain of custody, the better.','11110000-0000-4000-8000-000000000006',true,'pk_professor','platform','🎩')
on conflict (id) do nothing;

-- Each bot's first link sits directly on the paperclip (prev_link_id = null).
insert into chain_links (id, agent_id, item_id, prev_link_id, from_agent_id) values
  ('c1110000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','11110000-0000-4000-8000-000000000001',null,null),
  ('c1110000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002','11110000-0000-4000-8000-000000000002',null,null),
  ('c1110000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000003','11110000-0000-4000-8000-000000000003',null,null),
  ('c1110000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000004','11110000-0000-4000-8000-000000000004',null,null),
  ('c1110000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000005','11110000-0000-4000-8000-000000000005',null,null),
  ('c1110000-0000-4000-8000-000000000006','a0000000-0000-4000-8000-000000000006','11110000-0000-4000-8000-000000000006',null,null)
on conflict (id) do nothing;

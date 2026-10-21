-- Creator Campaign Contribution Planner (C24): initial schema
-- Run in the Supabase dashboard (SQL Editor) or via `supabase db push`.
-- Prerequisite: Authentication > Sign In / Providers > enable "Allow anonymous sign-ins".

-- ---------------------------------------------------------------------------
-- Shared reference data (everyone can read, nobody can write from the client)
-- ---------------------------------------------------------------------------
create table if not exists public.creators (
  slug                text primary key,               -- e.g. creator_001 (matches the seed JSON "id")
  name                text not null,
  handle              text,
  niche               text not null,
  location            text,
  followers           integer check (followers >= 0),
  primary_platform    text,
  platforms           text[] not null default '{}',
  audience_age        text,
  content_style       text[] not null default '{}',
  languages           text[] not null default '{}',
  estimated_rate_inr  integer check (estimated_rate_inr >= 0),
  collaboration_types text[] not null default '{}',
  bio                 text,
  metrics_note        text,
  clicks              integer check (clicks >= 0),
  buys                integer check (buys >= 0),
  platform_followers  jsonb not null default '{}'::jsonb
);

-- Commercial figures the planner uses (profit = orders * (sp*(1-discount/100) - cp) - fee).
create table if not exists public.creator_financials (
  creator_slug text primary key references public.creators(slug) on delete cascade,
  orders       integer       not null check (orders > 0),
  discount     numeric(5,2)  not null check (discount >= 0 and discount <= 100),
  sp           numeric(12,2) not null check (sp >= 0),   -- selling price
  cp           numeric(12,2) not null check (cp >= 0),   -- cost price
  fee          numeric(12,2) not null check (fee >= 0)   -- creator fee (INR)
);

-- ---------------------------------------------------------------------------
-- Per-visitor data (replaces localStorage). Each row belongs to auth.uid().
-- ---------------------------------------------------------------------------
create table if not exists public.campaign_settings (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  budget     numeric(14,2) not null default 2500000 check (budget > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.coupon_codes (
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  creator_slug text not null references public.creators(slug) on delete cascade,
  code         text not null check (char_length(code) between 1 and 20 and code = upper(code) and code !~ '\s'),
  updated_at   timestamptz not null default now(),
  primary key (user_id, creator_slug)
);

create table if not exists public.finder_shortlist (
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  platform     text not null check (platform in ('youtube', 'instagram')),
  username     text not null,
  username_key text generated always as (lower(username)) stored,
  followers    bigint check (followers >= 0),            -- null = creator hides their count
  niche        text not null,
  profile_url  text not null,
  fetched_at   timestamptz not null,                     -- retention clock (30 days)
  primary key (user_id, platform, username_key)
);

-- Real order data (the app still shows generated sample orders until you wire this up).
create table if not exists public.orders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  creator_slug text not null references public.creators(slug) on delete cascade,
  customer     text not null,
  item         text not null,
  price        numeric(12,2) not null check (price >= 0),
  status       text not null check (status in ('Delivered', 'Shipped', 'Returned')),
  ordered_at   timestamptz not null default now()
);
create index if not exists orders_user_creator_idx on public.orders (user_id, creator_slug);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.creators            enable row level security;
alter table public.creator_financials  enable row level security;
alter table public.campaign_settings   enable row level security;
alter table public.coupon_codes        enable row level security;
alter table public.finder_shortlist    enable row level security;
alter table public.orders              enable row level security;

create policy "creators are readable by everyone"
  on public.creators for select to anon, authenticated using (true);

create policy "financials are readable by everyone"
  on public.creator_financials for select to anon, authenticated using (true);

create policy "own settings"
  on public.campaign_settings for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own coupon codes"
  on public.coupon_codes for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Expired shortlist rows are hidden even before the purge job deletes them.
create policy "own unexpired shortlist (read)"
  on public.finder_shortlist for select to authenticated
  using ((select auth.uid()) = user_id and fetched_at > now() - interval '30 days');

create policy "own shortlist (insert)"
  on public.finder_shortlist for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "own shortlist (update)"
  on public.finder_shortlist for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own shortlist (delete)"
  on public.finder_shortlist for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "own orders"
  on public.orders for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Retention: delete shortlist rows older than 30 days (see README: YouTube/Meta policies)
-- ---------------------------------------------------------------------------
create or replace function public.purge_expired_shortlist()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.finder_shortlist where fetched_at < now() - interval '30 days';
$$;
revoke all on function public.purge_expired_shortlist() from public, anon, authenticated;

-- Schedules the purge daily if pg_cron is enabled (Dashboard > Database > Extensions).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purge-expired-shortlist', '17 3 * * *', 'select public.purge_expired_shortlist()');
  end if;
end $$;

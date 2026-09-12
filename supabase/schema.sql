-- The Workshop Master: durable serverless diagnostic memory
-- Run this once in Supabase Dashboard → SQL Editor → New query.

create table if not exists public.diagnostic_sessions (
  id uuid primary key,
  snapshot jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists diagnostic_sessions_updated_at_idx
  on public.diagnostic_sessions (updated_at desc);

create table if not exists public.channel_session_map (
  channel text not null check (channel in ('telegram', 'whatsapp')),
  external_user_id text not null,
  session_id uuid not null references public.diagnostic_sessions(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (channel, external_user_id)
);

alter table public.diagnostic_sessions enable row level security;
alter table public.channel_session_map enable row level security;

-- No browser client reads these tables. The server uses the service-role key,
-- which bypasses RLS; keeping public policies absent blocks anonymous access.

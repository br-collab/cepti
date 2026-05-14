-- CEPTI Social Media Agent (SMA) — Phase 1 schema
-- Tables: sma_tokens, sma_drafts, sma_scheduled_posts, sma_published_posts,
--         sma_comments, sma_reply_drafts, sma_metrics_snapshots
-- Auth model: single-user admin via Supabase Auth. All tables are RLS-gated:
-- only authenticated users (sma_admins membership) can read/write. The service
-- role bypasses RLS and is used by server-side jobs (cron, webhooks).

create extension if not exists "pgcrypto";

-- Admin membership table. A user is an admin iff there is a row here keyed
-- on their auth.users.id. We start with a single admin for now; the table
-- shape leaves room for adding teammates without a migration.
create table if not exists public.sma_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_sma_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(select 1 from public.sma_admins where user_id = auth.uid())
$$;

-- Platform enum used across SMA tables.
do $$ begin
  create type public.sma_platform as enum ('instagram', 'facebook', 'threads');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.sma_post_status as enum (
    'draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.sma_comment_class as enum (
    'inquiry', 'compliment', 'complaint', 'spam', 'other', 'unclassified'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.sma_reply_status as enum (
    'drafted', 'approved', 'posted', 'rejected', 'failed'
  );
exception when duplicate_object then null; end $$;

-- 1. Encrypted OAuth tokens, one row per (platform, external account id).
create table if not exists public.sma_tokens (
  id uuid primary key default gen_random_uuid(),
  platform public.sma_platform not null,
  external_account_id text not null,
  account_label text,
  access_token_ciphertext text not null,
  scopes text[] not null default '{}',
  expires_at timestamptz,
  last_refreshed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, external_account_id)
);

-- 2. Recommendation drafts produced by the recommender (Phase 2 writes; Phase 1 reads).
create table if not exists public.sma_drafts (
  id uuid primary key default gen_random_uuid(),
  platform public.sma_platform not null,
  format text not null,
  caption_es text,
  caption_en text,
  hashtags text[] not null default '{}',
  suggested_post_at timestamptz,
  funnel_role text,
  cta_strength text,
  creative_brief text,
  rationale text,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Drafts that have been approved + assigned a publish slot.
create table if not exists public.sma_scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid references public.sma_drafts(id) on delete set null,
  platform public.sma_platform not null,
  scheduled_for timestamptz not null,
  caption text not null,
  hashtags text[] not null default '{}',
  asset_url text,
  asset_kind text,
  status public.sma_post_status not null default 'scheduled',
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  last_attempt_at timestamptz,
  attempt_count int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sma_scheduled_posts_due_idx
  on public.sma_scheduled_posts (status, scheduled_for);

-- 4. What actually shipped, keyed by the platform's external id.
create table if not exists public.sma_published_posts (
  id uuid primary key default gen_random_uuid(),
  scheduled_id uuid references public.sma_scheduled_posts(id) on delete set null,
  platform public.sma_platform not null,
  external_post_id text not null,
  permalink text,
  published_at timestamptz not null default now(),
  caption text,
  hashtags text[] not null default '{}',
  unique (platform, external_post_id)
);

-- 5. Public comments observed via webhook or polling.
create table if not exists public.sma_comments (
  id uuid primary key default gen_random_uuid(),
  platform public.sma_platform not null,
  external_comment_id text not null,
  external_post_id text not null,
  parent_external_comment_id text,
  author_handle text,
  body text not null,
  posted_at timestamptz not null,
  classification public.sma_comment_class not null default 'unclassified',
  classification_confidence numeric,
  needs_human boolean not null default false,
  observed_at timestamptz not null default now(),
  unique (platform, external_comment_id)
);

create index if not exists sma_comments_triage_idx
  on public.sma_comments (needs_human, classification, observed_at);

-- 6. AI-drafted replies awaiting human approval.
create table if not exists public.sma_reply_drafts (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.sma_comments(id) on delete cascade,
  draft_body text not null,
  edited_body text,
  status public.sma_reply_status not null default 'drafted',
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  posted_at timestamptz,
  external_reply_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sma_reply_drafts_status_idx
  on public.sma_reply_drafts (status, created_at);

-- 7. Daily metrics snapshots per platform.
create table if not exists public.sma_metrics_snapshots (
  id uuid primary key default gen_random_uuid(),
  platform public.sma_platform not null,
  captured_on date not null,
  followers int,
  reach int,
  impressions int,
  profile_visits int,
  link_clicks int,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (platform, captured_on)
);

-- updated_at triggers
create or replace function public.sma_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  for t in select unnest(array[
    'sma_tokens', 'sma_drafts', 'sma_scheduled_posts', 'sma_reply_drafts'
  ]) loop
    execute format(
      'drop trigger if exists %I_touch on public.%I; ' ||
      'create trigger %I_touch before update on public.%I ' ||
      'for each row execute function public.sma_touch_updated_at();',
      t, t, t, t
    );
  end loop;
end $$;

-- RLS: admins read/write everything; nobody else gets anything via anon.
do $$
declare t text;
begin
  for t in select unnest(array[
    'sma_admins',
    'sma_tokens',
    'sma_drafts',
    'sma_scheduled_posts',
    'sma_published_posts',
    'sma_comments',
    'sma_reply_drafts',
    'sma_metrics_snapshots'
  ]) loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I_admin_all on public.%I;', t, t);
    execute format(
      'create policy %I_admin_all on public.%I ' ||
      'for all to authenticated ' ||
      'using (public.is_sma_admin()) ' ||
      'with check (public.is_sma_admin());',
      t, t
    );
  end loop;
end $$;

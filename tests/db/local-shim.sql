-- ============================================================================
-- LOCAL TEST DATABASE ONLY — never run this on a real Supabase project.
-- The plain supabase/postgres Docker image ships an older auth/storage schema
-- than hosted Supabase. This shim adds the pieces hosted Supabase already has
-- so the migrations can be tested unchanged.
-- ============================================================================
alter table storage.buckets add column if not exists public boolean default false;
alter table storage.buckets add column if not exists file_size_limit bigint;
alter table storage.buckets add column if not exists allowed_mime_types text[];

-- Hosted Supabase reads the JWT from request.jwt.claims (JSON).
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;
alter table auth.users add column if not exists raw_user_meta_data jsonb;

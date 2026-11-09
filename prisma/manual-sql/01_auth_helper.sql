-- Run ONCE as postgres (Supabase SQL Editor), not as a Prisma migration.
-- A one-line wrapper so RLS policies created by the prisma login can use the
-- signed-in user's id without access to Supabase's auth schema.
-- SECURITY INVOKER (the default): it runs as whoever queries, so it returns
-- that user's auth.uid() and nothing more.
create or replace function public.app_auth_uid()
  returns uuid
  language sql
  stable
  set search_path = ''
as $$ select auth.uid() $$;

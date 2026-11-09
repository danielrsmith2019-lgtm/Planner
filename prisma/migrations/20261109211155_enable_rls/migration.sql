-- Migration 3: enable_rls
-- Supabase exposes the public schema through its Data API (PostgREST), so any
-- table without row level security can be read with the public anon key.
-- This turns RLS on for every table and adds one policy per table: a signed-in
-- user (role "authenticated") can see and change only rows that belong to the
-- User whose authId matches their Supabase auth id. Anonymous requests see
-- nothing.
--
-- Prisma connects as a role that bypasses RLS, so these policies never affect
-- the app's own queries. forUser() in src/lib/db.ts is the app-level guard;
-- this is defense in depth.
--
-- (SELECT public.app_auth_uid()) is wrapped in a subquery so Postgres
-- evaluates it once per statement instead of once per row (Supabase's
-- recommended pattern for auth.uid()).

-- 0. Auth helper and shadow-database guard ----------------------------------
-- Policies call public.app_auth_uid(), a one-line wrapper around auth.uid().
-- The prisma login has no access to Supabase's auth schema (and can't be
-- granted it), but it can reference a function in public. On the real
-- database the wrapper is created once by the postgres login (see
-- prisma/manual-sql/01_auth_helper.sql), so this block does nothing there.
-- In the temporary shadow database `prisma migrate dev` uses, there is no
-- auth schema, so it creates stand-ins for auth.uid(), the wrapper and the
-- authenticated role. It never touches Supabase's real auth schema.
DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE
      AS $fn$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $fn$;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'app_auth_uid'
  ) THEN
    CREATE FUNCTION public.app_auth_uid() RETURNS uuid
      LANGUAGE sql STABLE SET search_path = ''
      AS $fn$ SELECT auth.uid() $fn$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $guard$;

-- 1. Turn RLS on everywhere ------------------------------------------------

ALTER TABLE "User"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Goal"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Milestone"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JournalEntry"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JournalLink"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActivityEvent" ENABLE ROW LEVEL SECURITY;

-- Prisma's migration ledger also lives in public. RLS with no policy hides it
-- from the Data API entirely. (Guarded: the shadow database may not have it.)
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- 2. User: only your own row ------------------------------------------------

CREATE POLICY "own_user_row" ON "User"
  FOR ALL TO authenticated
  USING ("authId" = (SELECT public.app_auth_uid()))
  WITH CHECK ("authId" = (SELECT public.app_auth_uid()));

-- 3. Tables with a userId column --------------------------------------------

CREATE POLICY "own_rows" ON "Goal"
  FOR ALL TO authenticated
  USING ("userId" IN (SELECT u."id" FROM "User" u WHERE u."authId" = (SELECT public.app_auth_uid())))
  WITH CHECK ("userId" IN (SELECT u."id" FROM "User" u WHERE u."authId" = (SELECT public.app_auth_uid())));

CREATE POLICY "own_rows" ON "Milestone"
  FOR ALL TO authenticated
  USING ("userId" IN (SELECT u."id" FROM "User" u WHERE u."authId" = (SELECT public.app_auth_uid())))
  WITH CHECK ("userId" IN (SELECT u."id" FROM "User" u WHERE u."authId" = (SELECT public.app_auth_uid())));

CREATE POLICY "own_rows" ON "Task"
  FOR ALL TO authenticated
  USING ("userId" IN (SELECT u."id" FROM "User" u WHERE u."authId" = (SELECT public.app_auth_uid())))
  WITH CHECK ("userId" IN (SELECT u."id" FROM "User" u WHERE u."authId" = (SELECT public.app_auth_uid())));

CREATE POLICY "own_rows" ON "JournalEntry"
  FOR ALL TO authenticated
  USING ("userId" IN (SELECT u."id" FROM "User" u WHERE u."authId" = (SELECT public.app_auth_uid())))
  WITH CHECK ("userId" IN (SELECT u."id" FROM "User" u WHERE u."authId" = (SELECT public.app_auth_uid())));

CREATE POLICY "own_rows" ON "ActivityEvent"
  FOR ALL TO authenticated
  USING ("userId" IN (SELECT u."id" FROM "User" u WHERE u."authId" = (SELECT public.app_auth_uid())))
  WITH CHECK ("userId" IN (SELECT u."id" FROM "User" u WHERE u."authId" = (SELECT public.app_auth_uid())));

-- 4. JournalLink has no userId: it belongs to whoever owns its entry ---------

CREATE POLICY "own_rows_via_entry" ON "JournalLink"
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM "JournalEntry" e
    JOIN "User" u ON u."id" = e."userId"
    WHERE e."id" = "JournalLink"."entryId" AND u."authId" = (SELECT public.app_auth_uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "JournalEntry" e
    JOIN "User" u ON u."id" = e."userId"
    WHERE e."id" = "JournalLink"."entryId" AND u."authId" = (SELECT public.app_auth_uid())
  ));

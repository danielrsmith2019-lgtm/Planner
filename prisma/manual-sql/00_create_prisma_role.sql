-- Run ONCE in the Supabase SQL Editor (not a Prisma migration).
-- Creates the database user Prisma connects as, per Supabase's Prisma guide.
--   bypassrls: the app's own queries aren't filtered by RLS (forUser() guards them)
--   createdb:  lets `prisma migrate dev` create its temporary shadow database
-- Replace PASTE_A_STRONG_PASSWORD with a generated password (letters and
-- numbers only, so it needs no escaping in the connection string). Save it:
-- it goes into .env.local.

create user "prisma" with password 'PASTE_A_STRONG_PASSWORD' bypassrls createdb;

-- Lets the dashboard Table Editor show Prisma-created tables.
grant "prisma" to "postgres";

grant usage on schema public to prisma;
grant create on schema public to prisma;
grant all on all tables in schema public to prisma;
grant all on all routines in schema public to prisma;
grant all on all sequences in schema public to prisma;
alter default privileges for role postgres in schema public grant all on tables to prisma;
alter default privileges for role postgres in schema public grant all on routines to prisma;
alter default privileges for role postgres in schema public grant all on sequences to prisma;

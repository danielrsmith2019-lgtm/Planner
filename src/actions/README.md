# src/actions

Server Actions: the thin, validated entry point from the client to services.

Belongs here:
- One file per area: tasks.ts, goals.ts, journal.ts
- Zod schemas for each action's input (in the same file or a sibling schemas.ts)

Every action follows the same shape:
1. 'use server' at the top of the file
2. Resolve the user from the Supabase session
3. Parse input with Zod
4. Call one service
5. Return { ok: true, data } or { ok: false, error }

Rules: no Prisma imports, no business logic.

# src/services

Server-side data access. The only folder that imports Prisma (along with src/lib/db.ts).

Belongs here:
- One file per aggregate: tasks.ts, goals.ts, milestones.ts, journal.ts, events.ts
- Functions like completeTask(userId, taskId) that run multi-step writes in one prisma.$transaction
- Read functions for screens (getDay, getGoalDetail)

Rules:
- Start every file with import 'server-only'
- Scope every query with db.forUser(userId)
- Enforce invariants: goalId derived from milestone, one target per JournalLink, idempotent completion
- Cached progress is written only from lib/domain output
- Convert Prisma types (Decimal, DATE) to plain domain types before returning

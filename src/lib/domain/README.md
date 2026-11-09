# src/lib/domain

The product's brain. All business logic lives here as pure TypeScript functions.

Belongs here:
- Progress math: computeMilestoneProgress, computeGoalProgress, computePace, computeAlignment
- buildRecap, carry-over rules, overlap packing for the timeline
- Date helpers, including getLocalToday(user), the only function that resolves "today"
- Domain types (plain objects; days are "YYYY-MM-DD" strings)

Rules:
- No imports from Next, React, Prisma, Supabase or anything that does I/O
- Plain objects in, plain objects out; no side effects
- Every file has a Vitest test beside it (progress.ts + progress.test.ts)
- Used twice: by services on the server and by hooks for optimistic updates

-- Migration 2: journal_link_one_target
-- A JournalLink points at exactly one thing: a goal, a milestone or a task.
-- Prisma can't express this rule, so the database enforces it. Any insert or
-- update that sets zero targets, or more than one, fails with a check
-- constraint error.

ALTER TABLE "JournalLink"
  ADD CONSTRAINT one_target
  CHECK (num_nonnulls("goalId", "milestoneId", "taskId") = 1);

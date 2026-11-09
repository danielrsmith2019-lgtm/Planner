# src/hooks

Client-side React hooks.

Belongs here:
- Mutation hooks: useCompleteTask, useScheduleTask, useSaveJournalEntry
- UI hooks: useVisualViewport, useSwipeRow, useDebouncedCallback

Rules:
- Mutations apply optimistic updates in onMutate using the same lib/domain functions
  the server uses, roll back in onError, and reconcile in onSettled
- Call Server Actions from src/actions; never import services or Prisma

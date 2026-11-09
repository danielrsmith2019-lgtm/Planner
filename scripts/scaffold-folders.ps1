# C:\Users\danie\Planner\scripts\scaffold-folders.ps1
# Creates the Planner source folders, each with a README explaining what belongs there.
# Safe to re-run: existing READMEs are left untouched.

$ErrorActionPreference = 'Stop'

$root = 'C:\Users\danie\Planner'
if (-not (Test-Path $root)) {
    throw "Project folder not found: $root"
}
Set-Location $root
Write-Host "Working in $root"

if (-not (Test-Path 'package.json')) {
    Write-Host 'Note: no package.json yet. Folders will still be created; run create-next-app here before writing code.'
}

$readmes = [ordered]@{

'src/lib/domain' = @'
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
'@

'src/services' = @'
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
'@

'src/actions' = @'
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
'@

'src/queries' = @'
# src/queries

TanStack Query key factories and queryOptions.

Belongs here:
- keys.ts: the query key factory (['day', date], ['goal', id], ['week', startDate])
- One queryOptions definition per screen: day.ts, week.ts, goal.ts, journal.ts

Rules:
- One query per screen, not one per entity; mutations update that single cache entry
- Default staleTime 60s with refetchOnWindowFocus (no websockets in V1)
'@

'src/hooks' = @'
# src/hooks

Client-side React hooks.

Belongs here:
- Mutation hooks: useCompleteTask, useScheduleTask, useSaveJournalEntry
- UI hooks: useVisualViewport, useSwipeRow, useDebouncedCallback

Rules:
- Mutations apply optimistic updates in onMutate using the same lib/domain functions
  the server uses, roll back in onError, and reconcile in onSettled
- Call Server Actions from src/actions; never import services or Prisma
'@

'src/stores' = @'
# src/stores

Zustand stores for UI state only.

Belongs here:
- Selected date, drag state, panel mode (Plan / Do / Reflect), open sheets

Rules:
- Never hold server data here; that belongs to TanStack Query
- One small store per concern (planner-ui.ts, shell-ui.ts)
'@

'src/components/shell' = @'
# src/components/shell

App navigation and layout chrome.

Belongs here:
- AppShell, Sidebar (desktop glass sidebar), BottomTabs (mobile, raised center + button)
- Header with the date navigator and the Plan / Do / Reflect mode chip

Rules: mobile-first at 393px, safe-area padding on bottom bars, 44px tap targets.
'@

'src/components/goals' = @'
# src/components/goals

Goal tracker UI.

Belongs here:
- GoalProgressWidget, GoalRing, GoalRail (desktop), GoalStrip (mobile)
- Goal cards, goal detail header, milestone list, pace badge, stalled state
- Reflection timeline on the goal detail page

Rules: goal accent colors only from the 5-color goal palette; progress as SVG rings or gradient bars.
'@

'src/components/planner' = @'
# src/components/planner

Planner UI.

Belongs here:
- DailyTimeline, TimeBlock, BacklogList, TopThree, NowCard
- Week view columns, carry-over triage, schedule sheet (time and duration chips)
- QuickAddSheet / CommandBar

Rules: drag on desktop, tap-to-schedule sheets and swipe rows on mobile.
'@

'src/components/journal' = @'
# src/components/journal

Journal UI.

Belongs here:
- ReflectionEditor (Tiptap), mention chips, slash menu
- DailyRecap node view, prompt picker, intention field, mood rating
- Journal month calendar

Rules: full-screen route on mobile with the toolbar pinned above the keyboard.
'@

'src/components/shared' = @'
# src/components/shared

Reusable building blocks used by more than one area.

Belongs here:
- BottomSheet (the one sheet primitive for every form), Metric, SectionLabel
- Glass card wrappers, buttons, inputs, pills, empty states

Rules: if a component is used by only one area, it lives in that area's folder instead.
Generated shadcn/ui primitives stay in src/components/ui.
'@

'src/utils' = @'
# src/utils

Small framework-level helpers that are not business logic.

Belongs here:
- icons.tsx: the only file that imports lucide-react; re-exports the icons the app uses
  (Planner CalendarClock, Journal NotebookPen, Goals Target, Quick add Plus, ...)
- cn() class-name helper, formatting helpers for display

Rules: anything that encodes product rules belongs in src/lib/domain, not here.
No emoji anywhere in the app; use an icon from icons.tsx instead.
'@
}

foreach ($dir in $readmes.Keys) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    $file = Join-Path $dir 'README.md'
    if (Test-Path $file) {
        Write-Host "skip  $file (already exists)"
        continue
    }
    Set-Content -Path $file -Value $readmes[$dir] -Encoding utf8
    Write-Host "made  $file"
}

Write-Host ''
Write-Host "Done: $($readmes.Count) folders ready."

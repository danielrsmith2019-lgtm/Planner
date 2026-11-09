# src/stores

Zustand stores for UI state only.

Belongs here:
- Selected date, drag state, panel mode (Plan / Do / Reflect), open sheets

Rules:
- Never hold server data here; that belongs to TanStack Query
- One small store per concern (planner-ui.ts, shell-ui.ts)

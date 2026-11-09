# src/utils

Small framework-level helpers that are not business logic.

Belongs here:
- icons.tsx: the only file that imports lucide-react; re-exports the icons the app uses
  (Planner CalendarClock, Journal NotebookPen, Goals Target, Quick add Plus, ...)
- cn() class-name helper, formatting helpers for display

Rules: anything that encodes product rules belongs in src/lib/domain, not here.
No emoji anywhere in the app; use an icon from icons.tsx instead.

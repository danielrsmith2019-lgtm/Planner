# src/queries

TanStack Query key factories and queryOptions.

Belongs here:
- keys.ts: the query key factory (['day', date], ['goal', id], ['week', startDate])
- One queryOptions definition per screen: day.ts, week.ts, goal.ts, journal.ts

Rules:
- One query per screen, not one per entity; mutations update that single cache entry
- Default staleTime 60s with refetchOnWindowFocus (no websockets in V1)

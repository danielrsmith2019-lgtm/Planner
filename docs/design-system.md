# Planner Design System: BaseCamp Light

2026-11-09 · Supersedes the visual spec in **blueprint Section 4** (the "dark navy, glass cards" language, the design-system table, the color semantics paragraph and the four v0 prompts). Section 4's layouts, routes, touch interactions and component list still apply; only the visual language changes.

Source of truth in code: `src/app/globals.css`, `src/lib/domain/goal-colors.ts`, `src/utils/icons.tsx`, and the live page at `/styleguide`.

## Why it changed

The blueprint described BaseCamp's original dark glass system. BaseCamp itself moved to a light Apple Health / Bevel / Fitbod system on 2026-05-14. Planner follows current BaseCamp: light only, white cards on a light gray canvas, Apple system colors.

## Tokens

| Role | Token / utility | Value |
| :-- | :-- | :-- |
| Page background | `bg-canvas` (shadcn `background`) | #F2F2F7 |
| Card | `bg-surface` (shadcn `card`, `popover`) | #FFFFFF |
| Subtle fill, hover | `bg-surface-alt` (shadcn `muted`) | #F9F9FB |
| Text | `text-fg` / `text-fg-secondary` / `text-fg-tertiary` | #1C1C1E / #8E8E93 / #AEAEB2 |
| Border | `border-border` / `border-border-strong` (shadcn `input`) | rgba(60,60,67,.12) / .25 |
| UI accent | `bc-blue` (shadcn `primary`, `ring`) | #007AFF |
| System colors | `bc-green` `bc-orange` `bc-red` `bc-purple` `bc-teal` `bc-pink` `bc-indigo`, each with `-light` and `-dark` | Apple HIG |
| Radius | `rounded-sm` / `md` / `lg` / `xl` | 10 / 14 / 20 / 24 px |
| Shadow | `shadow-card`, `shadow-card-hover`, `shadow-float` (raised + button) | very soft |
| Font | `font-sans`: SF Pro on Apple devices, DM Sans elsewhere. `font-mono`: SF Mono / JetBrains Mono, for times and paces only | |

Naming rule: BaseCamp's `text-primary/secondary/tertiary` are renamed `text-fg/fg-secondary/fg-tertiary` because shadcn owns `primary`, `secondary`, `muted`, `accent` and `card`. Never use `text-primary` for body text; in Planner it is blue.

## Goal colors (5 active goals max)

Blue and red are excluded because they mean "accent / ahead" and "missed".

| Goal | Base (rings, bars, dots) | -light (tints) | -dark (text on white) |
| :-- | :-- | :-- | :-- |
| goal-1 green | #34C759 | #E8F5E9 | #2E7D32 |
| goal-2 indigo | #5856D6 | #E8EAF6 | #283593 |
| goal-3 purple | #AF52DE | #F3E5F5 | #7B1FA2 |
| goal-4 orange | #FF9500 | #FFF3E0 | #E65100 |
| goal-5 teal | #5AC8FA | #E0F7FA | #00838F |

`Goal.color` stores the base hex. Its Prisma default is `#34C759` (the blueprint schema's `#4ADE80` is obsolete). Import hex values from `GOAL_COLORS` / `GOAL_PALETTE` in `src/lib/domain/goal-colors.ts`, and validate with `isGoalColor`.

Functional colors: `done` / `on-track` #34C759, `ahead` #007AFF, `behind` / `stalled` #FF9500, `missed` #FF3B30, `planned` #8E8E93. Pills pair a `-light` background with `-dark` text (e.g. `bg-bc-orange-light text-bc-orange-dark`).

## Component classes (globals.css)

| Pattern | Classes | Use in Planner |
| :-- | :-- | :-- |
| Cards | `bc-card` (padded), `bc-card-flush` (rows, no padding) | Every pane, card and sheet body |
| Accent bar | `bc-indicator` (4px bar, color via style or `bg-goal-n`) | Task blocks, goal cards, recap rows |
| Section labels | `bc-section-label` (11px, 600, uppercase, 0.08em, secondary) | "TODAY", "TOP 3", "GOALS", "REFLECTION" |
| Titles and text | `bc-section-title`, `bc-label`, `bc-caption`, `bc-wordmark` | |
| Numbers | `bc-stat`, `bc-data`, `bc-data-mono`, plus the `Metric` component | Alignment score, goal %, "212 / 500 km" |
| Buttons | `bc-btn-primary` (full width), `bc-btn-secondary` (blue tint), `bc-btn-log` (small inline) | |
| Inputs | `bc-input` | |
| Segmented control | `bc-tab-bar` + `bc-tab` (`active`) | Plan / Do / Reflect |
| Pills | `bc-pill` + color utilities | Pace, status, goal chips, duration |
| Insight row | `bc-insight` + `bc-insight-icon` | Stalled warnings, recap rows |
| Progress | `GoalRing` (solid stroke on #F2F2F7 track), `bc-progress-track` + `bc-progress-fill` | Goal rings, milestone bars |
| Shell | `bc-header` (frosted white, 56px + safe area), `bc-nav` + `bc-nav-item`, `bottom-nav-spacer` | App shell |
| States | `bc-skeleton`, `bc-empty` (+ `-icon`, `-title`, `-text`), `bc-divider`, `bc-avatar` | |
| Layout | `bento-grid` with `bento-full/hero/half/third/quarter`: 1 column, 2 at 640px, 4 at 768px | Today dashboard, Goals grid |
| Breakpoint helpers | `hide-mobile`, `hide-desktop` (640px) | |

Touch rule (from BaseCamp's mobile layer, in globals.css): under 640px every button, link and input gets `min-height: 44px` and inputs get 16px text, so iOS doesn't zoom. Icon-only buttons also need a 44px width.

Icons: lucide-react only, through `src/utils/icons.tsx` (`<Icon icon="planner" />`). No emoji anywhere.

## Changes to blueprint Section 4 wording

- "glass card" and "glass sidebar" now mean a white `bc-card` and a frosted white sidebar (rgba(255,255,255,.72) + 20px blur), matching `bc-header`.
- Goal rings use a solid goal-color stroke on a #F2F2F7 track, not a gradient on #1E293B.
- The desktop Today layout keeps its pane widths (280 / flex / 380-560 px); panes are `bc-card`s on the canvas, not a 12-column bento.
- The timeline "now" line and active states use #007AFF.

## v0 prompts (replace the four in blueprint Section 4)

Shared style block for every prompt:

> Light theme only, Apple Health style. Page #F2F2F7. Cards #FFFFFF, 20px radius, 0.5px border rgba(60,60,67,0.12), shadow 0 1px 3px rgba(0,0,0,0.04). Text #1C1C1E / #8E8E93 / #AEAEB2. Accent #007AFF. Section labels 11px, weight 600, uppercase, letter-spacing 0.08em, #8E8E93. Font: -apple-system, then DM Sans; numbers tabular-nums. Goal colors: green #34C759, indigo #5856D6, purple #AF52DE, orange #FF9500, teal #5AC8FA; tint backgrounds #E8F5E9 #E8EAF6 #F3E5F5 #FFF3E0 #E0F7FA. Functional: done #34C759, ahead #007AFF, behind #FF9500, missed #FF3B30. Icons lucide-react only, no emoji. All tap targets at least 44px. Use 100dvh.

**Prompt 1: Today screen, mobile.** Design a mobile-first (393x852) daily planner "Today" screen in Next.js + Tailwind + shadcn/ui. [shared style block] From top: (1) frosted white header, 56px plus safe area (rgba(255,255,255,0.72), 20px blur, hairline bottom border) with "< Wed, Nov 4 >" date nav, a segmented control "Plan | Do | Reflect" (white track, active segment #007AFF with white text), 28px avatar circle (#E3F2FD bg, #1565C0 initials). (2) Horizontal scroll strip of 4 goal rings (48px SVG, solid stroke in the goal color on a #F2F2F7 track, % inside, title below) in green, indigo, purple, orange; the orange one has a small orange "stalled" dot. (3) Full-width white card "NOW" showing the current time block (title, 7:30-8:15 in tabular-nums, 4px goal-color bar on the left, full-width #007AFF Complete button) and a smaller "NEXT" row. (4) "TOP 3": three 44px rows in one white card with dividers: checkbox, title, goal-color dot, a gray duration pill. (5) Vertical timeline 6:00-23:00 on white with faint 15-minute lines, a #007AFF now-line, task blocks tinted with the goal's light color and a 4px goal-color bar. Fixed frosted bottom tab bar (rgba(255,255,255,0.85), 20px blur, safe-area padding): Today, Week, raised 56px circular + button (#007AFF, soft blue shadow), Journal, Goals; inactive #AEAEB2, active #007AFF. Mock data; export Header, GoalStrip, NowCard, TopThree, DailyTimeline, BottomTabs as separate typed components.

**Prompt 2: desktop shell.** Using the same style [shared style block], build the desktop (>=1024px) Today screen. A 240px frosted white left sidebar (wordmark "Planner", nav: Today, Week, Journal, Goals, Settings with lucide icons; active item #007AFF text on a #007AFF 10% tint). Main area on #F2F2F7: 56px top bar (date nav, Plan|Do|Reflect segmented control, "Alignment 72%" pill, "Quick add Cmd K" button). Below, three white cards: Goals rail 280px (goal cards: 56px ring, title, pace pill Ahead / On track / Behind as #E3F2FD+#1565C0 / #E8F5E9+#2E7D32 / #FFF3E0+#E65100, "Next: <milestone>" in #8E8E93), Planner flex (backlog list 240px beside a 6:00-23:00 timeline), Journal 380px (recap card "3 done - Marathon +4% - Portfolio +10%", editor area, "One intention for tomorrow" input, full-width "Close day" #007AFF button). When mode = Reflect, the Journal card animates to 560px and the Goals rail collapses to a 64px column of rings. Mock data, typed props, one component per pane.

**Prompt 3: DailyTimeline with touch states.** Create DailyTimeline (TypeScript, Tailwind) in the same style [shared style block]. Props: date, tasks[{id,title,startMin,durationMin,goalColor,goalTint,status}], startHour=6, endHour=23, pxPerMin, variant ('desktop'|'mobile'). Hour grid with 15-minute subdivisions; blocks positioned absolutely by startMin/durationMin; overlapping blocks sit side by side. Block anatomy: goalTint background, 4px goalColor bar on the left, title, "7:30-8:15" in tabular-nums; completed = 50% opacity + strikethrough. Desktop: hover checkbox, bottom resize handle, dashed #007AFF "drop preview". Mobile: no resize handle; a swipe-row demo (swipe right reveals a #34C759 Check, left reveals a #FF9500 CalendarClock), and a white bottom sheet "Schedule" (drag handle, 20px top radius) with time chips: Next free slot, Morning, Afternoon, Evening, Pick time; duration chips 15/30/45/60/90; full-width #007AFF Save anchored at the bottom. No real drag logic. Mock 6 tasks.

**Prompt 4: GoalProgressWidget.** Create GoalProgressWidget (TypeScript, Tailwind, framer-motion) in the same style [shared style block]. Props: title, color (one of #34C759 #5856D6 #AF52DE #FF9500 #5AC8FA), progress 0..1, delta?, pace ('ahead'|'on_track'|'behind'|null), nextMilestone?, metric? ({current,target,unit}), isStalled, size ('strip'|'card'). Card: white card with a 4px goal-color bar on the left; 56px SVG ring, solid goal-color stroke on a #F2F2F7 track, animating from progress-delta to progress, with a "+4%" label that floats up and fades; title; pace pill (light tint background + dark text); metric line like "212 / 500 km" with the unit smaller and #AEAEB2; "Next: ..." in #8E8E93; if isStalled, an insight row with an orange AlertTriangle in a #FFF3E0 square, "No step scheduled this week" and a small #007AFF Schedule button. Strip: 48px ring with % inside and the title truncated below, 64px wide. Show a grid of 5 examples in different states. lucide-react icons only.

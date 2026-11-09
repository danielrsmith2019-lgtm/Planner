import type { ReactNode } from "react";
import GoalRing from "@/components/shared/GoalRing";
import Metric, { MetricRow } from "@/components/shared/Metric";
import { GOAL_COLORS, GOAL_PALETTE } from "@/lib/domain/goal-colors";
import { ICONS, Icon, type IconName } from "@/utils/icons";

export const metadata = { title: "Styleguide | Planner" };

type Swatch = { name: string; className: string; hex: string };

const SURFACES: Swatch[] = [
  { name: "canvas / background", className: "bg-canvas", hex: "#F2F2F7" },
  { name: "surface / card", className: "bg-surface", hex: "#FFFFFF" },
  { name: "surface-alt / muted", className: "bg-surface-alt", hex: "#F9F9FB" },
  { name: "border", className: "bg-border", hex: "rgba(60,60,67,.12)" },
  { name: "border-strong / input", className: "bg-border-strong", hex: "rgba(60,60,67,.25)" },
];

const TEXT: Swatch[] = [
  { name: "fg", className: "bg-fg", hex: "#1C1C1E" },
  { name: "fg-secondary", className: "bg-fg-secondary", hex: "#8E8E93" },
  { name: "fg-tertiary", className: "bg-fg-tertiary", hex: "#AEAEB2" },
  { name: "bc-blue / primary", className: "bg-bc-blue", hex: "#007AFF" },
];

const SYSTEM: Swatch[] = [
  { name: "bc-green", className: "bg-bc-green", hex: "#34C759" },
  { name: "bc-orange", className: "bg-bc-orange", hex: "#FF9500" },
  { name: "bc-red", className: "bg-bc-red", hex: "#FF3B30" },
  { name: "bc-purple", className: "bg-bc-purple", hex: "#AF52DE" },
  { name: "bc-teal", className: "bg-bc-teal", hex: "#5AC8FA" },
  { name: "bc-pink", className: "bg-bc-pink", hex: "#FF2D55" },
  { name: "bc-indigo", className: "bg-bc-indigo", hex: "#5856D6" },
];

const GOAL_CLASSES = [
  { base: "bg-goal-1", light: "bg-goal-1-light", dark: "text-goal-1-dark" },
  { base: "bg-goal-2", light: "bg-goal-2-light", dark: "text-goal-2-dark" },
  { base: "bg-goal-3", light: "bg-goal-3-light", dark: "text-goal-3-dark" },
  { base: "bg-goal-4", light: "bg-goal-4-light", dark: "text-goal-4-dark" },
  { base: "bg-goal-5", light: "bg-goal-5-light", dark: "text-goal-5-dark" },
];

const FUNCTIONAL: Swatch[] = [
  { name: "done / on-track", className: "bg-done", hex: "#34C759" },
  { name: "ahead", className: "bg-ahead", hex: "#007AFF" },
  { name: "behind / stalled", className: "bg-behind", hex: "#FF9500" },
  { name: "missed / destructive", className: "bg-missed", hex: "#FF3B30" },
  { name: "planned", className: "bg-planned", hex: "#8E8E93" },
];

const RING_SIZES = [48, 56, 80, 120];
const RING_PROGRESS = [0.12, 0.38, 0.64, 0.86, 1];
const GOAL_NAMES = ["Marathon", "Portfolio", "Reading", "Savings", "Spanish"];

export default function StyleguidePage() {
  return (
    <main className="min-h-dvh bg-canvas px-4 pb-[calc(2rem+var(--safe-bottom))] pt-6 md:px-8 md:pt-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <header className="flex flex-col gap-1">
          <span className="bc-section-label">Planner</span>
          <h1 className="text-[28px] font-bold tracking-tight text-fg">Styleguide</h1>
          <p className="bc-label">BaseCamp light system. Check this page at 393px first, then desktop.</p>
        </header>

        <Section title="Surfaces">
          <SwatchGrid swatches={SURFACES} />
        </Section>

        <Section title="Text and accent">
          <SwatchGrid swatches={TEXT} />
          <div className="bc-card flex flex-col gap-1">
            <p className="text-[17px] text-fg">Primary text: the daily planner that knows your goals.</p>
            <p className="bc-label">Secondary text (bc-label) for supporting detail.</p>
            <p className="bc-caption">Tertiary caption (bc-caption) for timestamps.</p>
            <p className="text-sm font-medium text-bc-blue">Accent text for links.</p>
          </div>
        </Section>

        <Section title="System colors">
          <SwatchGrid swatches={SYSTEM} />
        </Section>

        <Section title="Goal colors">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-5">
            {GOAL_PALETTE.map((g, i) => (
              <div key={g.base} className="bc-card-flush flex flex-col">
                <div className={`h-12 ${GOAL_CLASSES[i].base}`} />
                <div className={`flex items-center justify-between px-3 py-2 ${GOAL_CLASSES[i].light}`}>
                  <span className={`text-xs font-semibold ${GOAL_CLASSES[i].dark}`}>{GOAL_NAMES[i]}</span>
                  <span className={`bc-data text-xs ${GOAL_CLASSES[i].dark}`}>64%</span>
                </div>
                <div className="flex flex-col gap-0.5 p-2.5">
                  <span className="text-xs font-semibold text-fg">goal-{i + 1} ({g.name})</span>
                  <span className="bc-caption">
                    {g.base} / -light {g.light} / -dark {g.dark}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="bc-caption">Base for rings and bars, -light for tints, -dark for text on white.</p>
        </Section>

        <Section title="Functional colors">
          <SwatchGrid swatches={FUNCTIONAL} />
        </Section>

        <Section title="shadcn mapping">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-card">
            <p className="text-sm">
              A card styled only with shadcn tokens: <code className="bc-data-mono text-xs">bg-card border-border rounded-lg</code>
            </p>
            <p className="text-sm text-muted-foreground">text-muted-foreground maps to #8E8E93.</p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
                bg-primary
              </span>
              <span className="inline-flex min-h-11 items-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground">
                bg-secondary
              </span>
              <span className="inline-flex min-h-11 items-center rounded-md bg-muted px-4 text-sm text-muted-foreground">
                bg-muted
              </span>
              <span className="inline-flex min-h-11 items-center rounded-md bg-destructive px-4 text-sm font-medium text-white">
                bg-destructive
              </span>
              <span className="inline-flex min-h-11 items-center rounded-md border border-input bg-background px-4 text-sm ring-2 ring-ring ring-offset-2">
                ring-ring
              </span>
            </div>
          </div>
        </Section>

        <Section title="Typography">
          <div className="bc-card flex flex-col gap-4">
            <span className="bc-section-label">bc-section-label: Top 3</span>
            <span className="bc-section-title">bc-section-title: Today</span>
            <div className="flex flex-col gap-1">
              <span className="bc-stat">bc-stat 72%</span>
              <span className="bc-data">bc-data 212 / 500 km</span>
              <span className="bc-data-mono">bc-data-mono 07:30 - 08:15</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="bc-label">bc-label: 13px secondary</span>
              <span className="bc-caption">bc-caption: 11px tertiary</span>
              <span className="bc-wordmark font-bold">Planner</span>
            </div>
          </div>
        </Section>

        <Section title="Cards">
          <div className="bento-grid">
            <div className="bc-card bento-half">
              <span className="bc-section-label">bc-card</span>
              <p className="bc-label mt-2">White card, 20px radius, hairline border.</p>
            </div>
            <div className="bc-card-flush bento-half">
              <div className="flex flex-col divide-y divide-border">
                {GOAL_COLORS.slice(0, 3).map((hex, i) => (
                  <div key={hex} className="flex min-h-14 items-center gap-3 px-4 py-3">
                    <span className="bc-indicator self-stretch" style={{ background: hex }} />
                    <div className="flex flex-1 flex-col">
                      <span className="text-sm font-medium text-fg">Task block {i + 1}</span>
                      <span className="bc-caption">bc-card-flush row + bc-indicator</span>
                    </div>
                    <span className="bc-data-mono text-xs text-fg-secondary">07:30</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bc-insight bento-half">
              <div className="bc-insight-icon bg-bc-orange-light text-bc-orange-dark">
                <Icon icon="stalled" size={18} />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <span className="text-sm font-semibold text-fg">Savings is stalled</span>
                <span className="bc-label">No step scheduled in the next 7 days.</span>
                <button type="button" className="bc-btn-log self-start">
                  <Icon icon="planner" size={14} />
                  Schedule
                </button>
              </div>
            </div>
            <div className="bc-card bento-quarter">
              <span className="bc-section-label">bento-quarter</span>
            </div>
            <div className="bc-card bento-quarter">
              <div className="bc-skeleton h-4 w-3/4" />
              <div className="bc-skeleton mt-2 h-4 w-1/2" />
            </div>
            <div className="bc-card bento-full">
              <div className="bc-empty py-6">
                <Icon icon="goals" size={40} className="bc-empty-icon" />
                <span className="bc-empty-title">No goals yet</span>
                <span className="bc-empty-text">bc-empty: what are you working toward?</span>
              </div>
            </div>
          </div>
          <p className="bc-caption">bento-grid: 1 column on phones, 2 at 640px, 4 at 768px.</p>
        </Section>

        <Section title="Buttons">
          <div className="bc-card flex flex-col gap-3">
            <button type="button" className="bc-btn-primary">
              <Icon icon="complete" size={18} />
              Complete
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="bc-btn-secondary">
                <Icon icon="reschedule" size={16} />
                Reschedule
              </button>
              <button type="button" className="bc-btn-log">
                <Icon icon="add" size={14} />
                Log
              </button>
              <button type="button" className="bc-btn-secondary" disabled>
                Disabled
              </button>
              <button
                type="button"
                aria-label="Quick add"
                className="inline-flex size-14 items-center justify-center rounded-full bg-bc-blue text-white shadow-float"
              >
                <Icon icon="add" size={24} />
              </button>
            </div>
            <button type="button" className="bc-btn-primary" disabled>
              Disabled primary
            </button>
          </div>
        </Section>

        <Section title="Inputs">
          <div className="bc-card flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="bc-section-label">Task title</span>
              <input className="bc-input" placeholder="Long run 16km sat 7am @marathon" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="bc-section-label">One intention for tomorrow</span>
              <textarea className="bc-input min-h-24 resize-none" placeholder="Get the long run in before work" />
            </label>
            <input className="bc-input" placeholder="Disabled" disabled />
          </div>
        </Section>

        <Section title="Segmented tabs and pills">
          <div className="bc-card flex flex-col gap-4">
            <div className="bc-tab-bar">
              <button type="button" className="bc-tab">Plan</button>
              <button type="button" className="bc-tab active">Do</button>
              <button type="button" className="bc-tab">Reflect</button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill icon="ahead" label="Ahead" className="bg-bc-blue-light text-bc-blue-dark" />
              <Pill icon="flat" label="On track" className="bg-bc-green-light text-bc-green-dark" />
              <Pill icon="behind" label="Behind" className="bg-bc-orange-light text-bc-orange-dark" />
              <Pill icon="stalled" label="Stalled" className="bg-bc-orange-light text-bc-orange-dark" />
              <Pill icon="complete" label="Done" className="bg-bc-green-light text-bc-green-dark" />
              <span className="bc-pill bg-bc-red-light text-bc-red-dark">Overdue</span>
              <span className="bc-pill bg-canvas text-fg-secondary">30m</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {GOAL_NAMES.map((name, i) => (
                <span key={name} className={`bc-pill ${GOAL_CLASSES[i].light} ${GOAL_CLASSES[i].dark}`}>
                  <span className={`size-2 rounded-full ${GOAL_CLASSES[i].base}`} />
                  {name}
                </span>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Goal rings">
          <div className="bc-card flex flex-col gap-6">
            <div className="flex flex-wrap items-end gap-6">
              {RING_SIZES.map((size, i) => (
                <GoalRing key={size} size={size} progress={RING_PROGRESS[i + 1]} color={GOAL_COLORS[i]} label={`${size}px`} />
              ))}
            </div>
            <div className="flex gap-4 overflow-x-auto pb-1">
              {GOAL_COLORS.map((hex, i) => (
                <GoalRing key={hex} size={48} progress={RING_PROGRESS[i]} color={hex} label={GOAL_NAMES[i]} stalled={i === 3} />
              ))}
            </div>
            <p className="bc-caption">Strip row: 48px rings. The orange ring shows the stalled dot.</p>
          </div>
        </Section>

        <Section title="Progress bars">
          <div className="bc-card flex flex-col gap-3">
            {[0.25, 0.6, 0.95].map((p, i) => (
              <div key={p} className="flex items-center gap-3">
                <div className="bc-progress-track">
                  <div className="bc-progress-fill" style={{ width: `${p * 100}%`, background: GOAL_COLORS[i] }} />
                </div>
                <span className="bc-data w-10 text-right text-xs text-fg-secondary">{Math.round(p * 100)}%</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Metric">
          <div className="bento-grid">
            <div className="bc-card bento-half">
              <Metric size="hero" label="Alignment" value={72} unit="%" trend="up" trendValue="+8%" />
            </div>
            <div className="bc-card bento-half">
              <Metric size="lg" label="Marathon" value="212" unit="/ 500 km" color="text-goal-1-dark" trend="down" trendValue="Behind" />
            </div>
            <div className="bc-card bento-quarter">
              <Metric size="md" label="Done today" value={5} unit="tasks" trend="flat" trendValue="Same as avg" />
            </div>
            <div className="bc-card bento-quarter">
              <Metric size="md" label="Long run pace" value="5:42" unit="/km" mono />
            </div>
            <div className="bc-card bento-half">
              <Metric size="sm" label="Streak" value={12} unit="days" />
            </div>
            <div className="bc-card-flush bento-full flex flex-col divide-y divide-border px-4 py-1">
              <MetricRow label="Planned" value="6h 30m" />
              <MetricRow label="Goal-linked" value="4h 40m" color="text-bc-green-dark" />
              <MetricRow label="First block" value="07:30" mono />
            </div>
          </div>
        </Section>

        <Section title="Icons">
          <div className="bc-card grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {(Object.keys(ICONS) as IconName[]).map((name) => (
              <div key={name} className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-[14px] bg-canvas p-2">
                <Icon icon={name} size={22} className="text-fg" />
                <span className="bc-caption">{name}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Avatar and divider">
          <div className="bc-card flex flex-col">
            <div className="flex items-center gap-3">
              <span className="bc-avatar">DS</span>
              <span className="text-sm text-fg">bc-avatar</span>
            </div>
            <hr className="bc-divider" />
            <span className="bc-caption">bc-divider above</span>
          </div>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="bc-section-label">{title}</h2>
      {children}
    </section>
  );
}

function SwatchGrid({ swatches }: { swatches: Swatch[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
      {swatches.map((s) => (
        <div key={s.name} className="bc-card-flush flex flex-col">
          <div className={`h-14 border-b border-border ${s.className}`} />
          <div className="flex flex-col gap-0.5 p-2.5">
            <span className="text-xs font-semibold text-fg">{s.name}</span>
            <span className="bc-caption">{s.className}</span>
            <span className="bc-caption">{s.hex}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Pill({ icon, label, className }: { icon: IconName; label: string; className: string }) {
  return (
    <span className={`bc-pill ${className}`}>
      <Icon icon={icon} size={12} strokeWidth={2.5} />
      {label}
    </span>
  );
}

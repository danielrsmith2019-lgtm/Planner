import { Icon, type IconName } from "@/utils/icons";

/**
 * Metric: standardized numeric display, ported from BaseCamp (light).
 * Numbers use bc-data (DM Sans / SF Pro, tabular-nums, 600 weight).
 * Pass mono only for times and paces, e.g. "5:42".
 *
 * Sizes:
 *   hero  32px  dashboard hero tiles
 *   lg    22px  KPI cards
 *   md    18px  inline stats (default)
 *   sm    14px  table cells, compact views
 */

export type MetricSize = "hero" | "lg" | "md" | "sm";
export type MetricTrend = "up" | "down" | "flat";

const SIZE_MAP: Record<MetricSize, { value: string; unit: string; label: string; icon: number }> = {
  hero: { value: "text-[32px]", unit: "text-base", label: "text-xs", icon: 14 },
  lg: { value: "text-[22px]", unit: "text-sm", label: "text-[10px]", icon: 12 },
  md: { value: "text-lg", unit: "text-xs", label: "text-[10px]", icon: 12 },
  sm: { value: "text-sm", unit: "text-[10px]", label: "text-[9px]", icon: 10 },
};

// BaseCamp used text arrows here; Planner uses icons only.
const TREND_MAP: Record<MetricTrend, { icon: IconName; color: string }> = {
  up: { icon: "ahead", color: "text-bc-green-dark" },
  down: { icon: "behind", color: "text-bc-red" },
  flat: { icon: "flat", color: "text-fg-secondary" },
};

export type MetricProps = {
  value: string | number;
  unit?: string;
  label?: string;
  size?: MetricSize;
  /** Tailwind text color class for the value, e.g. "text-goal-1-dark". */
  color?: string;
  /** Monospace, for times and paces only. */
  mono?: boolean;
  trend?: MetricTrend;
  /** Shown beside the trend icon, e.g. "+4%". */
  trendValue?: string;
  className?: string;
};

export default function Metric({
  value,
  unit,
  label,
  size = "md",
  color = "text-fg",
  mono = false,
  trend,
  trendValue,
  className = "",
}: MetricProps) {
  const s = SIZE_MAP[size];
  const dataClass = mono ? "bc-data-mono" : "bc-data";
  const t = trend ? TREND_MAP[trend] : null;

  return (
    <div className={`flex flex-col ${className}`}>
      {label && <span className={`bc-caption mb-1 uppercase tracking-wider ${s.label}`}>{label}</span>}

      <div className="flex items-baseline gap-1">
        <span className={`${dataClass} font-bold ${s.value} ${color}`}>{value}</span>
        {unit && <span className={`bc-caption ${s.unit}`}>{unit}</span>}
      </div>

      {t && trendValue && (
        <div className={`mt-0.5 flex items-center gap-1 ${t.color}`}>
          <Icon icon={t.icon} size={s.icon} strokeWidth={2.5} />
          <span className="bc-data text-xs font-semibold">{trendValue}</span>
        </div>
      )}
    </div>
  );
}

export type MetricRowProps = {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
  mono?: boolean;
};

/** Horizontal label + value, for sheets and tables. */
export function MetricRow({ label, value, unit, color = "text-fg", mono = false }: MetricRowProps) {
  const dataClass = mono ? "bc-data-mono" : "bc-data";
  return (
    <div className="flex min-h-11 items-center justify-between">
      <span className="text-xs text-fg-secondary">{label}</span>
      <div className="flex items-baseline gap-0.5">
        <span className={`${dataClass} text-sm font-bold ${color}`}>{value}</span>
        {unit && <span className="bc-caption text-[10px]">{unit}</span>}
      </div>
    </div>
  );
}

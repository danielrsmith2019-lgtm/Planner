"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { formatDate } from "@/lib/domain/dates";
import { goalReflectionsQuery } from "@/queries/journal";
import { Icon } from "@/utils/icons";

/**
 * A goal's Reflections: every journal block that @-mentioned the goal or one
 * of its milestones, newest first. Tapping one opens that day's entry
 * scrolled to the block (/journal/[date]?block=<blockId>).
 */
export default function ReflectionsList({ goalId, color }: { goalId: string; color: string }) {
  const reflections = useQuery(goalReflectionsQuery(goalId));

  if (reflections.isPending) return <div className="bc-card bc-skeleton h-24" aria-hidden="true" />;
  if (reflections.isError) {
    return (
      <p className="bc-card bc-label" role="alert">
        Couldn&apos;t load reflections: {reflections.error.message}
      </p>
    );
  }
  if (reflections.data.length === 0) {
    return (
      <div className="bc-card bc-empty">
        <Icon icon="journal" size={32} className="bc-empty-icon" />
        <p className="bc-empty-text">Type @ in your journal to mention this goal or a milestone. Those notes collect here.</p>
      </div>
    );
  }
  return (
    <ol className="bc-card-flush divide-y divide-border overflow-hidden">
      {reflections.data.map((item) => (
        <li key={item.linkId}>
          <Link
            href={`/journal/${item.date}?block=${encodeURIComponent(item.blockId)}`}
            className="flex min-h-14 gap-3 px-4 py-3 hover:bg-surface-alt"
          >
            <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[13px] font-semibold text-fg">{formatDate(item.date)}</span>
                {item.milestone !== null && (
                  <span className="bc-pill gap-1 bg-surface-alt py-0.5 text-fg-secondary">
                    <Icon icon="milestone" size={12} />
                    {item.milestone.title}
                  </span>
                )}
              </span>
              <span className="mt-1 line-clamp-3 block text-[15px] leading-snug text-fg-secondary">{item.snippet}</span>
            </span>
            <Icon icon="next" size={18} className="mt-1 shrink-0 text-fg-tertiary" />
          </Link>
        </li>
      ))}
    </ol>
  );
}

"use client";

import { createPortal } from "react-dom";
import type { MentionTargetType } from "@/lib/domain/mentions";
import type { Mentionable } from "@/services/mentionables";
import { cn } from "@/utils/cn";
import { Icon } from "@/utils/icons";
import { MENTION_ICON } from "./MentionChip";

const GROUP_LABEL: Record<MentionTargetType, string> = { GOAL: "Goals", MILESTONE: "Milestones", TASK: "Tasks" };

export type MentionMenuState = {
  items: Mentionable[];
  query: string;
  /** Where the "@" is on screen (desktop popover anchor). */
  rect: DOMRect | null;
};

/**
 * The "@" picker. Desktop: a frosted popover under the caret. Phones: a sheet
 * pinned just above the keyboard (bottomOffset comes from visualViewport plus
 * any toolbar), with 44px rows. Rows keep editor focus (mousedown is
 * prevented), so the keyboard stays up.
 */
export default function MentionMenu({
  state,
  selected,
  onSelect,
  onHover,
  mobile,
  bottomOffset,
}: {
  state: MentionMenuState;
  selected: number;
  onSelect: (item: Mentionable) => void;
  onHover: (index: number) => void;
  mobile: boolean;
  bottomOffset: number;
}) {
  const { items, query, rect } = state;
  const listId = "mention-menu-list";

  const body = (
    <div
      role="listbox"
      id={listId}
      aria-label={query === "" ? "Mention a goal, milestone or task" : `Mentions matching ${query}`}
      className="flex flex-col py-1"
    >
      {items.length === 0 ? (
        <p className="bc-caption px-4 py-3">{query === "" ? "Type to search goals, milestones and tasks." : `Nothing matches "${query}".`}</p>
      ) : (
        items.map((item, index) => {
          const showHeader = index === 0 || items[index - 1]?.type !== item.type;
          return (
            <div key={`${item.type}:${item.id}`}>
              {showHeader && <p className="px-4 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-fg-tertiary uppercase">{GROUP_LABEL[item.type]}</p>}
              <button
                type="button"
                role="option"
                aria-selected={index === selected}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => onHover(index)}
                onClick={() => onSelect(item)}
                className={cn("flex min-h-11 w-full items-center gap-3 px-4 text-left", index === selected && "bg-bc-blue-light/70")}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full" style={{ color: item.color ?? "var(--color-fg-tertiary)" }}>
                  <Icon icon={MENTION_ICON[item.type]} size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] text-fg">{item.label}</span>
                  {item.context !== null && <span className="bc-caption block truncate">{item.context}</span>}
                </span>
              </button>
            </div>
          );
        })
      )}
    </div>
  );

  const panel = mobile ? (
    <div
      className="fixed inset-x-0 z-[70] max-h-[45dvh] overflow-y-auto rounded-t-[20px] border-t border-border bg-surface shadow-card-hover"
      style={{ bottom: bottomOffset }}
    >
      <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-border-strong" />
      {body}
    </div>
  ) : (
    <div
      className="fixed z-[70] max-h-80 w-[320px] overflow-y-auto rounded-[14px] border border-border bg-surface/90 shadow-card-hover backdrop-blur-xl"
      style={{ top: (rect?.bottom ?? 0) + 6, left: Math.min(rect?.left ?? 0, (typeof window === "undefined" ? 1024 : window.innerWidth) - 336) }}
    >
      {body}
    </div>
  );

  return createPortal(panel, document.body);
}

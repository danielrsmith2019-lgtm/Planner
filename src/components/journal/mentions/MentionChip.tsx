"use client";

import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { goalShades, isGoalColor } from "@/lib/domain/goal-colors";
import type { MentionTargetType } from "@/lib/domain/mentions";
import { Icon, type IconName } from "@/utils/icons";
import { useMentionColor } from "./MentionColors";

export const MENTION_ICON: Record<MentionTargetType, IconName> = { GOAL: "goals", MILESTONE: "milestone", TASK: "task" };

const isTarget = (value: unknown): value is MentionTargetType => value === "GOAL" || value === "MILESTONE" || value === "TASK";

/**
 * A mention as a pill: the goal's color at low opacity behind text in the
 * goal's dark shade, with Target / Flag / CircleCheck for goal / milestone / task.
 * Mentions with no known goal color use the accent blue.
 */
export default function MentionChip({ node }: ReactNodeViewProps) {
  const id = typeof node.attrs.id === "string" ? node.attrs.id : null;
  const label = typeof node.attrs.label === "string" ? node.attrs.label : (id ?? "");
  const type = isTarget(node.attrs.targetType) ? node.attrs.targetType : "GOAL";
  const color = useMentionColor(id);
  const base = color ?? "#007AFF";
  const text = color !== null && isGoalColor(color) ? goalShades(color).dark : "#0062CC";

  return (
    <NodeViewWrapper
      as="span"
      data-type="mention"
      data-mention-id={id ?? undefined}
      className="journal-mention-chip"
      style={{ backgroundColor: `color-mix(in srgb, ${base} 16%, transparent)`, color: text }}
      contentEditable={false}
    >
      <Icon icon={MENTION_ICON[type]} size={13} strokeWidth={2.25} className="shrink-0" />
      <span>{label}</span>
    </NodeViewWrapper>
  );
}

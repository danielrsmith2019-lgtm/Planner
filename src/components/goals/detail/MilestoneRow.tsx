"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDate } from "@/lib/domain/dates";
import { isReadyToClose, type MilestoneDetail } from "@/lib/domain/goal-detail";
import type { DayTask } from "@/lib/domain/goal-tree";
import { cn } from "@/utils/cn";
import { Icon } from "@/utils/icons";
import AddTaskRow from "./AddTaskRow";
import TaskCheckRow from "./TaskCheckRow";

export type MilestoneRowProps = {
  milestone: MilestoneDetail;
  color: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  onOpenActions: () => void;
  onToggleTask: (task: DayTask, milestone: MilestoneDetail) => void;
  onAddTask: (milestone: MilestoneDetail, title: string, done: () => void) => void;
  onMarkComplete: (milestone: MilestoneDetail) => void;
  addingTask: boolean;
};

/** Open tasks first (rank order), then done and skipped. */
function orderTasks(tasks: DayTask[]): DayTask[] {
  return [...tasks.filter((t) => t.status === "TODO"), ...tasks.filter((t) => t.status !== "TODO")];
}

/**
 * One milestone: drag handle, title, task count, optional target date and a
 * gradient progress bar in the goal color. Tapping the body expands its tasks.
 */
export default function MilestoneRow({
  milestone,
  color,
  expanded,
  onToggleExpanded,
  onOpenActions,
  onToggleTask,
  onAddTask,
  onMarkComplete,
  addingTask,
}: MilestoneRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: milestone.id,
  });
  const done = milestone.status === "DONE";
  const ready = isReadyToClose(milestone);
  const total = milestone.counts.todo + milestone.counts.done;
  const percent = Math.round(milestone.progress * 100);
  const panelId = `milestone-${milestone.id}-tasks`;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("bc-card list-none p-0", isDragging && "relative z-10 shadow-card-hover")}
    >
      <div className="flex items-start gap-1 py-2 pr-1 pl-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${milestone.title}`}
          className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-fg-tertiary active:cursor-grabbing"
        >
          <Icon icon="drag" size={18} />
        </button>

        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="min-w-0 flex-1 py-1.5 text-left"
        >
          <div className="flex items-start gap-2">
            <h3 className={cn("min-w-0 flex-1 text-[15px] font-semibold leading-snug", done ? "text-fg-secondary" : "text-fg")}>
              {milestone.title}
            </h3>
            <span className="bc-data shrink-0 text-[14px]" style={{ color }}>
              {percent}%
            </span>
            <Icon
              icon="expand"
              size={18}
              className={cn("mt-px shrink-0 text-fg-tertiary transition-transform", expanded && "rotate-180")}
            />
          </div>
          <p className="bc-caption mt-0.5">
            {total === 0 ? "No tasks yet" : `${milestone.counts.done} of ${total} ${total === 1 ? "task" : "tasks"}`}
            {` · Weight ${milestone.weight}`}
            {milestone.targetDate !== null && ` · Due ${formatDate(milestone.targetDate)}`}
          </p>
          <div
            className="bc-progress-track mt-2"
            role="progressbar"
            aria-label={`${milestone.title} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div
              className="bc-progress-fill"
              style={{ width: `${percent}%`, background: `linear-gradient(90deg, ${color}80, ${color})` }}
            />
          </div>
          {(done || ready) && (
            <span
              className="bc-pill mt-2"
              style={
                done
                  ? { background: "var(--color-bc-green-light)", color: "var(--color-bc-green-dark)" }
                  : { background: "var(--color-bc-blue-light)", color: "var(--color-bc-blue)" }
              }
            >
              {done ? "Done" : "Ready to close"}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onOpenActions}
          aria-label={`Actions for ${milestone.title}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-fg-secondary hover:bg-surface-alt"
        >
          <Icon icon="more" size={20} />
        </button>
      </div>

      {expanded && (
        <div id={panelId} className="border-t border-border px-1 pt-1 pb-2">
          {milestone.tasks.length > 0 && (
            <ul>
              {orderTasks(milestone.tasks).map((task) => (
                <TaskCheckRow key={task.id} task={task} color={color} onToggle={(t) => onToggleTask(t, milestone)} />
              ))}
            </ul>
          )}
          {!done && (
            <AddTaskRow
              milestoneTitle={milestone.title}
              pending={addingTask}
              onAdd={(title, clear) => onAddTask(milestone, title, clear)}
            />
          )}
          {ready && (
            <div className="px-2 pt-2">
              <button type="button" onClick={() => onMarkComplete(milestone)} className="bc-btn-secondary min-h-11 w-full">
                <Icon icon="complete" size={18} />
                Mark milestone complete
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

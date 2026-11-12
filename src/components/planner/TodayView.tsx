"use client";

import { DndContext, DragOverlay } from "@dnd-kit/core";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import JournalPane, { JournalLinkCard } from "@/components/journal/JournalPane";
import BottomSheet from "@/components/shared/BottomSheet";
import { useCompleteTask } from "@/hooks/useCompleteTask";
import { useDayPlacement, useUpdateTask } from "@/hooks/useDayPlacement";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useCreateTask, useResolveCarryOver } from "@/hooks/useTaskMutations";
import { hasTopThreeRoom, MAX_TOP_THREE, splitForTimeline } from "@/lib/domain/day-lists";
import { moveSelection, placementOf, selectionOrder, type Placement } from "@/lib/domain/day-schedule";
import { formatDayLabel, minutesToLabel, type LocalDate } from "@/lib/domain/dates";
import type { DayData, DayTask, GoalNode } from "@/lib/domain/goal-tree";
import { carryOverQuery } from "@/queries/carry-over";
import { dayQuery } from "@/queries/day";
import { useUiStore } from "@/stores/ui";
import { cn } from "@/utils/cn";
import { Icon } from "@/utils/icons";
import BacklogList from "./BacklogList";
import CarryOverSheet from "./CarryOverSheet";
import DailyTimeline, { type TimelineGeometry } from "./DailyTimeline";
import GoalStrip, { type RingDelta } from "./GoalStrip";
import TaskForm from "./TaskForm";
import { taskFormFromTask } from "./task-form";
import TaskRow from "./TaskRow";
import UndoToast, { type UndoAction } from "./UndoToast";
import { useTimelineDrag, type DropIntent } from "./useTimelineDrag";

const TASK_FORM_ID = "new-task-form";
const EDIT_FORM_ID = "edit-task-form";
const DELTA_VISIBLE_MS = 2200;
/** Matches the shell: drag-and-drop is a desktop (768px up) feature. */
const DESKTOP_QUERY = "(min-width: 768px)";

/**
 * Today: Top 3, an Anytime list, then the day timeline. 768px up the goals and
 * backlog sit in a 240px column and tasks drag onto the timeline; 1024px up
 * the journal is on the right.
 */
export default function TodayView() {
  const date = useUiStore((s) => s.selectedDate);
  const today = useUiStore((s) => s.today);
  if (date === null || today === null) return <TodaySkeleton />;
  return <TodayFor date={date} today={today} />;
}

function TodaySkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <div className="bc-card bc-skeleton h-20" />
      <div className="bc-card bc-skeleton h-40" />
    </div>
  );
}

function TodayFor({ date, today }: { date: LocalDate; today: LocalDate }) {
  const day = useQuery(dayQuery(date));
  if (day.isPending) return <TodaySkeleton />;
  if (day.isError) {
    return (
      <section className="bc-card">
        <p className="bc-section-label">Couldn&apos;t load this day</p>
        <p className="bc-label mt-2">{day.error.message}</p>
      </section>
    );
  }
  return <TodayBoard date={date} today={today} data={day.data} />;
}

/** True while typing in a field or the journal editor, so shortcuts stay out of the way. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function describePlacement(task: DayTask, placement: Placement, type: DropIntent["type"] | "backlog"): string {
  if (placement.scheduledDate === null) return `Moved "${task.title}" to the backlog`;
  if (type === "resize-handle") return `Resized "${task.title}" to ${placement.durationMin ?? 30} min`;
  return placement.startMin === null ? `Moved "${task.title}"` : `Moved "${task.title}" to ${minutesToLabel(placement.startMin)}`;
}

function TodayBoard({ date, today, data }: { date: LocalDate; today: LocalDate; data: DayData }) {
  const timezone = useUiStore((s) => s.timezone);
  const isToday = date === today;
  const carryOver = useQuery({ ...carryOverQuery(), enabled: isToday });
  const complete = useCompleteTask();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const place = useDayPlacement(date);
  const resolveCarry = useResolveCarryOver();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  // 1024px up: the journal sits in a right pane; below that, a link card.
  const withJournalPane = useMediaQuery("(min-width: 1024px)");

  const [delta, setDelta] = useState<RingDelta | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formTopThree, setFormTopThree] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [carryOpen, setCarryOpen] = useState(false);
  const [backlogOpen, setBacklogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoAction | null>(null);
  const deltaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geometryRef = useRef<TimelineGeometry | null>(null);
  useEffect(
    () => () => {
      if (deltaTimer.current !== null) clearTimeout(deltaTimer.current);
    },
    [],
  );

  const goalById = new Map<string, GoalNode>(data.goalTree.map((g) => [g.id, g]));
  const { topThree, anytime, timed } = splitForTimeline(data.tasks);
  const order = selectionOrder([topThree, anytime, timed]);
  const allTasks = [...data.tasks, ...data.backlog];
  const findTask = (id: string | null) => (id === null ? undefined : allTasks.find((t) => t.id === id));
  const unfinished = isToday && carryOver.isSuccess ? carryOver.data.tasks : [];
  const editing = findTask(editingId);
  const dismissUndo = useCallback(() => setUndo(null), []);
  const offerUndo = (label: string, run: () => void) => setUndo((prev) => ({ id: (prev?.id ?? 0) + 1, label, undo: run }));

  /** Complete / uncomplete; offerUndo is false when this call is itself an undo. */
  const toggle = (task: DayTask, offer = true) => {
    setNotice(null);
    const direction = task.status === "DONE" ? "uncomplete" : "complete";
    complete.mutate(
      { taskId: task.id, direction },
      {
        // The ring itself moved optimistically; the badge shows the server's delta.
        onSuccess: (result) => {
          if (result.goal === null || !result.changed || result.delta === 0) return;
          if (deltaTimer.current !== null) clearTimeout(deltaTimer.current);
          setDelta({ goalId: result.goal.id, delta: result.delta, key: Date.now() });
          deltaTimer.current = setTimeout(() => setDelta(null), DELTA_VISIBLE_MS);
        },
        onError: (error) => setNotice(error.message),
      },
    );
    if (offer) {
      const undone = { ...task, status: direction === "complete" ? ("DONE" as const) : ("TODO" as const) };
      offerUndo(direction === "complete" ? `Completed "${task.title}"` : `Marked "${task.title}" not done`, () => toggle(undone, false));
    }
  };

  /** Move, resize, schedule or unschedule, with an undo that restores the old placement. */
  const placeTask = (task: DayTask, placement: Placement, type: DropIntent["type"] | "backlog", offer = true) => {
    setNotice(null);
    const previous = placementOf(task);
    place.mutate({ taskId: task.id, placement, previous }, { onError: (error) => setNotice(error.message) });
    if (offer) {
      const moved: DayTask = { ...task, ...placement, rank: task.rank };
      offerUndo(describePlacement(task, placement, type), () => placeTask(moved, previous, type, false));
    }
  };

  const drag = useTimelineDrag({
    date,
    geometryRef,
    onDrop: ({ type, task, placement }) => placeTask(task, placement, type),
  });

  // Keyboard: J/K select, X complete, E edit, Delete to backlog, Cmd/Ctrl+Z undo.
  const keyState = useRef({ order, selectedId, undo, toggle, placeTask, findTask, sheetOpen: false });
  useEffect(() => {
    keyState.current = { order, selectedId, undo, toggle, placeTask, findTask, sheetOpen: formOpen || editingId !== null || carryOpen };
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const s = keyState.current;
      if (isEditableTarget(event.target)) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
        if (s.undo === null) return;
        event.preventDefault();
        s.undo.undo();
        setUndo(null);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || s.sheetOpen) return;
      const key = event.key.toLowerCase();
      if (key === "j" || key === "k") {
        event.preventDefault();
        const next = moveSelection(s.order, s.selectedId, key === "j" ? 1 : -1);
        setSelectedId(next);
        if (next !== null) document.querySelector(`[data-task-id="${next}"]`)?.scrollIntoView({ block: "nearest" });
        return;
      }
      if (key === "escape") {
        setSelectedId(null);
        return;
      }
      const task = s.findTask(s.selectedId);
      if (task === undefined) return;
      if (key === "x") {
        event.preventDefault();
        s.toggle(task);
      } else if (key === "e") {
        event.preventDefault();
        updateTask.reset();
        setEditingId(task.id);
      } else if ((event.key === "Delete" || event.key === "Backspace") && task.scheduledDate !== null) {
        event.preventDefault();
        s.placeTask(task, { scheduledDate: null, startMin: null, durationMin: task.durationMin }, "backlog");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [updateTask]);

  const openForm = (topThree: boolean) => {
    createTask.reset();
    setFormTopThree(topThree);
    setFormOpen(true);
  };

  const rowFor = (task: DayTask) => {
    const goal = task.goalId === null ? undefined : goalById.get(task.goalId);
    return (
      <TaskRow
        key={task.id}
        task={task}
        goalColor={goal?.color}
        goalTitle={goal?.title}
        onToggle={(t) => toggle(t)}
        dragEnabled={desktop}
        selected={selectedId === task.id}
      />
    );
  };

  const draggingTask = drag.active?.task ?? null;
  const overlayGoal = draggingTask?.goalId == null ? undefined : goalById.get(draggingTask.goalId);

  return (
    <DndContext
      id="today"
      sensors={drag.sensors}
      collisionDetection={drag.collisionDetection}
      onDragStart={drag.onDragStart}
      onDragMove={drag.onDragMove}
      onDragEnd={drag.onDragEnd}
      onDragCancel={drag.onDragCancel}
    >
      <div
        data-wide
        className="flex flex-col gap-5 md:grid md:grid-cols-[240px_minmax(0,1fr)] md:items-start md:gap-6 lg:grid-cols-[240px_minmax(0,1fr)_minmax(300px,360px)] lg:gap-5"
      >
        {/* Phones: goal strip on top. 768px up: goals, then the backlog, in a 240px column. */}
        <aside className="flex flex-col gap-5 md:sticky md:top-[calc(56px+var(--safe-top)+24px)] md:max-h-[calc(100dvh-56px-var(--safe-top)-48px)] md:overflow-y-auto">
          <div>
            <h2 className="bc-section-label mb-1 hidden md:block">Goals</h2>
            <GoalStrip goals={data.goalTree} delta={delta} />
          </div>
          {desktop && (
            <section aria-labelledby="backlog-rail-heading" className="flex flex-col gap-2">
              <div className="flex min-h-11 items-center gap-2">
                <h2 id="backlog-rail-heading" className="bc-section-label">
                  Backlog
                </h2>
                <span className="bc-caption">{data.backlog.length}</span>
              </div>
              <div className="bc-card-flush overflow-hidden">
                <BacklogList tasks={data.backlog} goals={data.goalTree} onToggle={(t) => toggle(t)} dragEnabled selectedId={selectedId} />
              </div>
            </section>
          )}
        </aside>

        <div className="flex min-w-0 flex-col gap-5">
          {unfinished.length > 0 && (
            <button
              type="button"
              onClick={() => {
                resolveCarry.reset();
                setCarryOpen(true);
              }}
              className="flex min-h-12 items-center gap-3 rounded-[14px] bg-bc-orange-light px-4 text-left text-bc-orange-dark"
            >
              <Icon icon="reschedule" size={20} className="shrink-0" />
              <span className="min-w-0 flex-1 text-[15px] font-semibold">{unfinished.length} unfinished from earlier</span>
              <span className="shrink-0 text-[14px] font-semibold">Review</span>
              <Icon icon="next" size={18} className="shrink-0" />
            </button>
          )}

          {notice !== null && (
            <div role="alert" className="flex items-start gap-2 rounded-[14px] bg-bc-red-light py-1 pr-1 pl-4 text-bc-red-dark">
              <p className="flex-1 py-2.5 text-[14px] font-medium">{notice}</p>
              <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} className="flex size-11 shrink-0 items-center justify-center">
                <Icon icon="close" size={18} />
              </button>
            </div>
          )}

          <Section
            title="Top 3"
            count={`${topThree.length}/${MAX_TOP_THREE}`}
            action={
              topThree.length < MAX_TOP_THREE ? (
                <button type="button" onClick={() => openForm(true)} className="flex min-h-11 items-center gap-1 px-2 text-[14px] font-semibold text-bc-blue">
                  <Icon icon="add" size={16} />
                  Add
                </button>
              ) : undefined
            }
          >
            {topThree.length === 0 ? (
              <p className="bc-label px-4 py-3">Pick up to 3 tasks that would make {isToday ? "today" : "this day"} a win.</p>
            ) : (
              <ul className="divide-y divide-border">{topThree.map(rowFor)}</ul>
            )}
          </Section>

          <Section
            title="Anytime"
            count={String(anytime.length)}
            action={
              <button type="button" onClick={() => openForm(false)} className="flex min-h-11 items-center gap-1 px-2 text-[14px] font-semibold text-bc-blue">
                <Icon icon="add" size={16} />
                Add task
              </button>
            }
          >
            {anytime.length === 0 ? (
              <p className="bc-label px-4 py-3">Nothing without a time on {isToday ? "today" : formatDayLabel(date, { short: true })}.</p>
            ) : (
              <ul className="divide-y divide-border">{anytime.map(rowFor)}</ul>
            )}
          </Section>

          <section aria-labelledby="timeline-heading" className="flex flex-col gap-2">
            <div className="flex min-h-11 items-center gap-2">
              <h2 id="timeline-heading" className="bc-section-label">
                Timeline
              </h2>
              <span className="bc-caption">{timed.length}</span>
            </div>
            <div className="bc-card px-3 pt-1 pb-1">
              <DailyTimeline
                tasks={timed}
                goals={data.goalTree}
                showNow={isToday}
                timezone={timezone}
                onToggle={(t) => toggle(t)}
                dragEnabled={desktop}
                geometryRef={geometryRef}
                preview={drag.preview}
                draggingId={draggingTask?.id ?? null}
                selectedId={selectedId}
              />
            </div>
            {desktop && (
              <p className="bc-caption">
                Drag tasks onto the timeline; drag a block&apos;s bottom edge to resize. Keys: J/K select, X complete, E edit, Delete to
                backlog, Ctrl+Z undo.
              </p>
            )}
          </section>

          {/* Phones: the backlog sits at the end, collapsed. */}
          {!desktop && (
            <section aria-labelledby="backlog-heading" className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setBacklogOpen((v) => !v)}
                aria-expanded={backlogOpen}
                aria-controls="backlog-list"
                className="flex min-h-11 items-center gap-2 text-left"
              >
                <h2 id="backlog-heading" className="bc-section-label">
                  Backlog
                </h2>
                <span className="bc-caption">{data.backlog.length}</span>
                <Icon icon="expand" size={16} className={cn("ml-auto text-fg-tertiary transition-transform", backlogOpen && "rotate-180")} />
              </button>
              {backlogOpen && (
                <div id="backlog-list" className="bc-card-flush overflow-hidden">
                  <BacklogList tasks={data.backlog} goals={data.goalTree} onToggle={(t) => toggle(t)} />
                </div>
              )}
            </section>
          )}

          {!withJournalPane && <JournalLinkCard date={date} isToday={isToday} />}
        </div>

        {withJournalPane && (
          <div className="lg:sticky lg:top-[calc(56px+var(--safe-top)+24px)]">
            <JournalPane date={date} />
          </div>
        )}
      </div>

      {/* A backlog or list row follows the pointer; blocks stay put and the dashed preview shows the target. */}
      <DragOverlay dropAnimation={null}>
        {drag.active?.type === "backlog-task" && draggingTask !== null ? (
          <div className="w-[240px] cursor-grabbing rounded-[10px] border border-border border-l-[3px] bg-surface px-3 py-2 shadow-card-hover"
            style={{ borderLeftColor: overlayGoal?.color ?? "var(--color-border-strong)" }}>
            <p className="truncate text-[14px] font-medium text-fg">{draggingTask.title}</p>
            <p className="bc-caption">{draggingTask.durationMin ?? 30} min</p>
          </div>
        ) : null}
      </DragOverlay>

      <UndoToast action={undo} onDismiss={dismissUndo} />

      <BottomSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        title="New task"
        primaryAction={{ label: "Add task", form: TASK_FORM_ID, pending: createTask.isPending, pendingLabel: "Adding..." }}
        footerNote={
          createTask.error === null ? undefined : (
            <p role="alert" className="rounded-[10px] bg-bc-red-light px-3 py-2.5 text-[13px] font-medium text-bc-red-dark">
              {createTask.error.message}
            </p>
          )
        }
      >
        {formOpen && (
          <TaskForm
            id={TASK_FORM_ID}
            today={today}
            viewing={date}
            goals={data.goalTree}
            defaultTopThree={formTopThree && hasTopThreeRoom(data.tasks)}
            topThreeFullOn={hasTopThreeRoom(data.tasks) ? null : date}
            onSubmit={(values) => createTask.mutate(values, { onSuccess: () => setFormOpen(false) })}
          />
        )}
      </BottomSheet>

      <BottomSheet
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditingId(null);
        }}
        title="Edit task"
        primaryAction={{ label: "Save", form: EDIT_FORM_ID, pending: updateTask.isPending, pendingLabel: "Saving..." }}
        footerNote={
          updateTask.error === null ? undefined : (
            <p role="alert" className="rounded-[10px] bg-bc-red-light px-3 py-2.5 text-[13px] font-medium text-bc-red-dark">
              {updateTask.error.message}
            </p>
          )
        }
      >
        {editing !== undefined && (
          <TaskForm
            id={EDIT_FORM_ID}
            today={today}
            viewing={editing.scheduledDate ?? date}
            goals={data.goalTree}
            defaultTopThree={editing.isTopThree}
            topThreeFullOn={editing.isTopThree || hasTopThreeRoom(data.tasks) ? null : date}
            initial={taskFormFromTask(editing, today, data.goalTree)}
            onSubmit={(values, { linkChanged }) =>
              updateTask.mutate(
                {
                  taskId: editing.id,
                  values: {
                    title: values.title,
                    scheduledDate: values.scheduledDate,
                    durationMin: values.durationMin,
                    isTopThree: values.isTopThree,
                    // Only send the link when it was changed, so a link the picker can't show is kept.
                    ...(linkChanged ? { link: values.link } : {}),
                  },
                },
                { onSuccess: () => setEditingId(null) },
              )
            }
          />
        )}
      </BottomSheet>

      {isToday && carryOver.isSuccess && (
        <CarryOverSheet
          open={carryOpen}
          onOpenChange={setCarryOpen}
          today={today}
          tasks={carryOver.data.tasks}
          goals={data.goalTree}
          pending={resolveCarry.isPending}
          error={resolveCarry.error?.message ?? null}
          onApply={(decisions) => resolveCarry.mutate(decisions, { onSuccess: () => setCarryOpen(false) })}
        />
      )}
    </DndContext>
  );
}

function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const id = `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <div className="flex min-h-11 items-center gap-2">
        <h2 id={id} className="bc-section-label">
          {title}
        </h2>
        <span className="bc-caption">{count}</span>
        <div className="ml-auto">{action}</div>
      </div>
      <div className="bc-card-flush overflow-hidden">{children}</div>
    </section>
  );
}

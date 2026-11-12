"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import BottomSheet from "@/components/shared/BottomSheet";
import { useCompleteTask } from "@/hooks/useCompleteTask";
import { useCreateTask, useResolveCarryOver } from "@/hooks/useTaskMutations";
import { hasTopThreeRoom, MAX_TOP_THREE, splitDayTasks } from "@/lib/domain/day-lists";
import { formatDayLabel, type LocalDate } from "@/lib/domain/dates";
import type { DayData, DayTask, GoalNode } from "@/lib/domain/goal-tree";
import { carryOverQuery } from "@/queries/carry-over";
import { dayQuery } from "@/queries/day";
import { useUiStore } from "@/stores/ui";
import { cn } from "@/utils/cn";
import { Icon } from "@/utils/icons";
import CarryOverSheet from "./CarryOverSheet";
import GoalStrip, { type RingDelta } from "./GoalStrip";
import TaskForm from "./TaskForm";
import TaskRow from "./TaskRow";

const TASK_FORM_ID = "new-task-form";
const DELTA_VISIBLE_MS = 2200;

/** Today (list version; the timeline arrives on Day 16). */
export default function TodayView() {
  const date = useUiStore((s) => s.selectedDate);
  const today = useUiStore((s) => s.today);
  if (date === null || today === null) {
    return (
      <div className="flex flex-col gap-4" aria-hidden="true">
        <div className="bc-card bc-skeleton h-20" />
        <div className="bc-card bc-skeleton h-40" />
      </div>
    );
  }
  return <TodayFor date={date} today={today} />;
}

function TodayFor({ date, today }: { date: LocalDate; today: LocalDate }) {
  const day = useQuery(dayQuery(date));
  const isToday = date === today;
  const carryOver = useQuery({ ...carryOverQuery(), enabled: isToday });
  const complete = useCompleteTask();
  const createTask = useCreateTask();
  const resolveCarry = useResolveCarryOver();

  const [delta, setDelta] = useState<RingDelta | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formTopThree, setFormTopThree] = useState(false);
  const [carryOpen, setCarryOpen] = useState(false);
  const [backlogOpen, setBacklogOpen] = useState(false);
  const deltaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (deltaTimer.current !== null) clearTimeout(deltaTimer.current);
  }, []);

  if (day.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-hidden="true">
        <div className="bc-card bc-skeleton h-20" />
        <div className="bc-card bc-skeleton h-40" />
      </div>
    );
  }
  if (day.isError) {
    return (
      <section className="bc-card">
        <p className="bc-section-label">Couldn&apos;t load this day</p>
        <p className="bc-label mt-2">{day.error.message}</p>
      </section>
    );
  }

  const data: DayData = day.data;
  const goalById = new Map<string, GoalNode>(data.goalTree.map((g) => [g.id, g]));
  const { topThree, rest } = splitDayTasks(data.tasks);
  const unfinished = isToday && carryOver.isSuccess ? carryOver.data.tasks : [];

  const toggle = (task: DayTask) => {
    setNotice(null);
    complete.mutate(
      { taskId: task.id, direction: task.status === "DONE" ? "uncomplete" : "complete" },
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
  };

  const openForm = (topThree: boolean) => {
    createTask.reset();
    setFormTopThree(topThree);
    setFormOpen(true);
  };

  const rowFor = (task: DayTask) => {
    const goal = task.goalId === null ? undefined : goalById.get(task.goalId);
    return <TaskRow key={task.id} task={task} goalColor={goal?.color} goalTitle={goal?.title} onToggle={toggle} />;
  };

  return (
    <div className="flex flex-col gap-5 md:grid md:grid-cols-[208px_minmax(0,1fr)] md:items-start md:gap-6">
      <aside className="md:sticky md:top-[calc(56px+var(--safe-top)+24px)]">
        <h2 className="bc-section-label mb-1 hidden md:block">Goals</h2>
        <GoalStrip goals={data.goalTree} delta={delta} />
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
            <span className="min-w-0 flex-1 text-[15px] font-semibold">
              {unfinished.length} unfinished from earlier
            </span>
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
          title={isToday ? "Today" : formatDayLabel(date, { short: true })}
          count={String(rest.length)}
          action={
            <button type="button" onClick={() => openForm(false)} className="flex min-h-11 items-center gap-1 px-2 text-[14px] font-semibold text-bc-blue">
              <Icon icon="add" size={16} />
              Add task
            </button>
          }
        >
          {rest.length === 0 ? (
            <p className="bc-label px-4 py-3">Nothing else scheduled.</p>
          ) : (
            <ul className="divide-y divide-border">{rest.map(rowFor)}</ul>
          )}
        </Section>

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
              {data.backlog.length === 0 ? (
                <p className="bc-label px-4 py-3">No unscheduled tasks.</p>
              ) : (
                <ul className="divide-y divide-border">{data.backlog.map(rowFor)}</ul>
              )}
            </div>
          )}
        </section>
      </div>

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
    </div>
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

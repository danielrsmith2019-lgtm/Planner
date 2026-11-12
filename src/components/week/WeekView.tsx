"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import TaskForm from "@/components/planner/TaskForm";
import BottomSheet from "@/components/shared/BottomSheet";
import { useCompleteTask } from "@/hooks/useCompleteTask";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useScheduleTask } from "@/hooks/useScheduleTask";
import { useCreateTask } from "@/hooks/useTaskMutations";
import { hasTopThreeRoom } from "@/lib/domain/day-lists";
import type { LocalDate } from "@/lib/domain/dates";
import type { DayTask } from "@/lib/domain/goal-tree";
import { startOfWeek } from "@/lib/domain/week";
import { findWeekTask, planMoveToEnd, type WeekMove } from "@/lib/domain/week-board";
import { weekQuery } from "@/queries/week";
import { useUiStore } from "@/stores/ui";
import { Icon } from "@/utils/icons";
import WeekBoard from "./WeekBoard";
import WeekList from "./WeekList";
import WeekTaskSheet from "./WeekTaskSheet";

const TASK_FORM_ID = "week-task-form";
/** Matches the shell: bottom tabs below 768px, sidebar from 768px. */
const BOARD_QUERY = "(min-width: 768px)";

/** Week view: the week containing the selected date, Monday to Sunday. */
export default function WeekView() {
  const selected = useUiStore((s) => s.selectedDate);
  const today = useUiStore((s) => s.today);
  if (selected === null || today === null) return <div className="bc-card bc-skeleton h-64" aria-hidden="true" />;
  return <WeekFor start={startOfWeek(selected)} today={today} />;
}

function WeekFor({ start, today }: { start: LocalDate; today: LocalDate }) {
  const week = useQuery(weekQuery(start));
  const board = useMediaQuery(BOARD_QUERY);
  const schedule = useScheduleTask(start);
  const complete = useCompleteTask();
  const createTask = useCreateTask();
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [addOn, setAddOn] = useState<LocalDate | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (week.isPending) return <div className="bc-card bc-skeleton h-64" aria-hidden="true" />;
  if (week.isError) {
    return (
      <section className="bc-card">
        <p className="bc-section-label">Couldn&apos;t load this week</p>
        <p className="bc-label mt-2">{week.error.message}</p>
      </section>
    );
  }

  const data = week.data;
  // Read the open task from the cache so the sheet reflects moves and completions.
  const openTask = openTaskId === null ? null : (findWeekTask(data, openTaskId)?.task ?? null);
  const addDay = addOn === null ? undefined : data.days.find((d) => d.date === addOn);

  const move = (m: WeekMove, sendRank: boolean) => {
    setNotice(null);
    schedule.mutate({ ...m, sendRank }, { onError: (error) => setNotice(error.message) });
  };

  const moveTo = (task: DayTask, toDate: LocalDate) => {
    try {
      const plan = planMoveToEnd(data, task.id, toDate);
      if (plan === null) return;
      // Days outside this week aren't loaded, so let the server pick the rank there.
      move(plan, data.days.some((d) => d.date === toDate));
      setOpenTaskId(null);
    } catch {
      setNotice("Couldn't move that task. Refresh and try again.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {notice !== null && (
        <div role="alert" className="flex items-start gap-2 rounded-[14px] bg-bc-red-light py-1 pr-1 pl-4 text-bc-red-dark">
          <p className="flex-1 py-2.5 text-[14px] font-medium">{notice}</p>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} className="flex size-11 shrink-0 items-center justify-center">
            <Icon icon="close" size={18} />
          </button>
        </div>
      )}

      {board ? (
        <WeekBoard
          week={data}
          today={today}
          onMove={(m) => move(m, true)}
          onMoveError={setNotice}
          onOpenTask={(task) => setOpenTaskId(task.id)}
          onAddTask={setAddOn}
        />
      ) : (
        <WeekList week={data} today={today} onOpenTask={(task) => setOpenTaskId(task.id)} onAddTask={setAddOn} />
      )}

      <WeekTaskSheet
        task={openTask}
        weekStart={start}
        goals={data.goalTree}
        onOpenChange={(open) => {
          if (!open) setOpenTaskId(null);
        }}
        onMove={moveTo}
        onToggleDone={(task) => {
          setOpenTaskId(null);
          complete.mutate(
            { taskId: task.id, direction: task.status === "DONE" ? "uncomplete" : "complete" },
            { onError: (error) => setNotice(error.message) },
          );
        }}
      />

      <BottomSheet
        open={addOn !== null}
        onOpenChange={(open) => {
          if (!open) setAddOn(null);
        }}
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
        {addOn !== null && (
          <TaskForm
            id={TASK_FORM_ID}
            today={today}
            viewing={addOn}
            goals={data.goalTree}
            defaultTopThree={false}
            topThreeFullOn={addDay !== undefined && !hasTopThreeRoom(addDay.tasks) ? addOn : null}
            onSubmit={(values) => createTask.mutate(values, { onSuccess: () => setAddOn(null) })}
          />
        )}
      </BottomSheet>
    </div>
  );
}

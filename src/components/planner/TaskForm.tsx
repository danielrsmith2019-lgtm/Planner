"use client";

import { useId, useState, type FormEvent } from "react";
import type { NewTaskValues } from "@/hooks/useTaskMutations";
import { DURATION_CHOICES, formatDuration } from "@/lib/domain/day-lists";
import type { LocalDate } from "@/lib/domain/dates";
import type { GoalNode } from "@/lib/domain/goal-tree";
import { cn } from "@/utils/cn";
import { Icon } from "@/utils/icons";
import {
  initialTaskForm,
  resolveDate,
  searchLinkOptions,
  validateTaskForm,
  type DateChoice,
  type LinkOption,
  type TaskFormErrors,
  type TaskFormState,
} from "./task-form";

const DATE_CHOICES: { value: DateChoice; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "pick", label: "Pick" },
  { value: "backlog", label: "Backlog" },
];

/**
 * New task: title, a goal / milestone link picker (choosing a milestone sets
 * its goal), date (Today / Tomorrow / Pick, or Backlog), duration chips and a
 * Top 3 toggle. The server enforces 3 Top 3 tasks per day; topThreeFull only
 * explains it up front for the day already on screen.
 */
export default function TaskForm({
  id,
  today,
  viewing,
  goals,
  defaultTopThree,
  topThreeFullOn,
  initial,
  onSubmit,
}: {
  id: string;
  today: LocalDate;
  viewing: LocalDate;
  goals: GoalNode[];
  defaultTopThree: boolean;
  /** The date shown on screen, if its Top 3 is already full. */
  topThreeFullOn: LocalDate | null;
  /** Edit: start from an existing task (taskFormFromTask). */
  initial?: TaskFormState;
  onSubmit: (values: NewTaskValues, meta: { linkChanged: boolean }) => void;
}) {
  const [state, setState] = useState<TaskFormState>(() => initial ?? initialTaskForm(today, viewing, defaultTopThree));
  const [errors, setErrors] = useState<TaskFormErrors>({});
  const set = <K extends keyof TaskFormState>(key: K, value: TaskFormState[K]) => setState((s) => ({ ...s, [key]: value }));
  const titleId = useId();

  const date = resolveDate(state, today);
  const isBacklog = date === null;
  const fullHere = date !== null && date === topThreeFullOn;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateTaskForm(state, today);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    onSubmit(result.values, { linkChanged: state.linkChanged });
  };

  return (
    <form id={id} onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={titleId} className="bc-label text-fg">
          Task
        </label>
        <input
          id={titleId}
          value={state.title}
          onChange={(e) => {
            set("title", e.target.value);
            setErrors((x) => ({ ...x, title: undefined }));
          }}
          aria-invalid={errors.title !== undefined}
          placeholder="Draft the case study intro"
          maxLength={200}
          autoComplete="off"
          className="bc-input min-h-11 text-[16px]"
        />
        {errors.title !== undefined && <p className="text-[13px] font-medium text-bc-red-dark">{errors.title}</p>}
      </div>

      <LinkPicker goals={goals} value={state.link} onChange={(link) => setState((s) => ({ ...s, link, linkChanged: true }))} />

      <fieldset className="flex flex-col gap-1.5">
        <legend className="bc-label mb-1.5 text-fg">When</legend>
        <div role="radiogroup" aria-label="When" className="grid grid-cols-4 gap-1 rounded-[12px] bg-surface-alt p-1">
          {DATE_CHOICES.map((choice) => (
            <button
              key={choice.value}
              type="button"
              role="radio"
              aria-checked={state.dateChoice === choice.value}
              onClick={() => set("dateChoice", choice.value)}
              className={cn(
                "min-h-11 rounded-[10px] text-[14px] font-semibold transition-colors",
                state.dateChoice === choice.value ? "bg-surface text-fg shadow-card" : "text-fg-secondary",
              )}
            >
              {choice.label}
            </button>
          ))}
        </div>
        {state.dateChoice === "pick" && (
          <input
            type="date"
            aria-label="Date"
            value={state.pickedDate}
            onChange={(e) => set("pickedDate", e.target.value)}
            className="bc-input mt-2 min-h-11 text-[16px]"
          />
        )}
        {errors.date !== undefined && <p className="text-[13px] font-medium text-bc-red-dark">{errors.date}</p>}
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="bc-label mb-1.5 text-fg">Duration</legend>
        <div role="radiogroup" aria-label="Duration" className="flex flex-wrap gap-2">
          {DURATION_CHOICES.map((minutes) => (
            <button
              key={minutes}
              type="button"
              role="radio"
              aria-checked={state.durationMin === minutes}
              onClick={() => set("durationMin", minutes)}
              className={cn(
                "min-h-11 min-w-14 rounded-full px-4 text-[14px] font-semibold transition-colors",
                state.durationMin === minutes ? "bg-bc-blue text-white" : "bg-surface-alt text-fg-secondary",
              )}
            >
              {formatDuration(minutes)}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="bc-label text-fg">Top 3</p>
          <p className="bc-caption">
            {isBacklog ? "Pick a day to make it a Top 3." : fullHere ? "That day already has 3." : "One of the 3 that make the day a win."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={state.isTopThree && !isBacklog}
          aria-label="Top 3"
          disabled={isBacklog || (fullHere && !state.isTopThree)}
          onClick={() => set("isTopThree", !state.isTopThree)}
          className="flex min-h-11 shrink-0 items-center disabled:opacity-40"
        >
          <span
            className={cn(
              "relative h-[31px] w-[51px] rounded-full transition-colors",
              state.isTopThree && !isBacklog ? "bg-bc-green" : "bg-border-strong",
            )}
          >
            <span
              className={cn(
                "absolute top-[2px] left-[2px] size-[27px] rounded-full bg-white shadow-card transition-transform",
                state.isTopThree && !isBacklog && "translate-x-5",
              )}
            />
          </span>
        </button>
      </div>
    </form>
  );
}

function LinkPicker({
  goals,
  value,
  onChange,
}: {
  goals: GoalNode[];
  value: LinkOption | null;
  onChange: (link: LinkOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const options = searchLinkOptions(goals, query);

  if (value !== null) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="bc-label text-fg">Goal</p>
        <div className="flex min-h-11 items-center gap-2 rounded-[10px] border border-border-strong pl-3">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: value.color }} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-[15px] text-fg">
            {value.kind === "milestone" ? (
              <>
                <span className="text-fg-secondary">{value.goalTitle} / </span>
                {value.label}
              </>
            ) : (
              value.label
            )}
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remove goal link"
            className="flex size-11 shrink-0 items-center justify-center text-fg-secondary"
          >
            <Icon icon="close" size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={searchId} className="bc-label text-fg">
        Goal
      </label>
      <input
        id={searchId}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search goals and milestones"
        autoComplete="off"
        className="bc-input min-h-11 text-[16px]"
      />
      {goals.length === 0 ? (
        <p className="bc-caption">No active goals. The task will stand on its own.</p>
      ) : options.length === 0 ? (
        <p className="bc-caption">Nothing matches. Leave it unlinked or try another word.</p>
      ) : (
        <ul aria-label="Goals and milestones" className="max-h-52 overflow-y-auto rounded-[10px] border border-border">
          {options.map((option) => (
            <li key={option.kind === "goal" ? option.goalId : option.milestoneId}>
              <button
                type="button"
                onClick={() => onChange(option)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2 px-3 text-left hover:bg-surface-alt",
                  option.kind === "milestone" && "pl-8",
                )}
              >
                <span
                  className={cn("shrink-0 rounded-full", option.kind === "goal" ? "size-2.5" : "size-1.5")}
                  style={{ background: option.color }}
                  aria-hidden="true"
                />
                <span className={cn("min-w-0 flex-1 truncate text-[15px]", option.kind === "goal" ? "font-semibold text-fg" : "text-fg")}>
                  {option.label}
                </span>
                {option.kind === "milestone" && <span className="bc-caption shrink-0">Milestone</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

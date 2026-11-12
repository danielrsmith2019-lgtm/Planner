"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import type { CreateGoalValues } from "@/hooks/useGoalMutations";
import type { GoalPaletteEntry } from "@/lib/domain/goal-colors";
import type { LocalDate } from "@/lib/domain/dates";
import { cn } from "@/utils/cn";
import { Icon } from "@/utils/icons";
import { initialGoalForm, validateGoalForm, type GoalFormErrors, type GoalFormState } from "./goal-form";

type GoalFormProps = {
  /** The form's id; BottomSheet's primary button submits it. */
  id: string;
  /** The user's day from the UI store; null until the header syncs the clock. */
  today: LocalDate | null;
  /** Colors no other active goal uses (freeGoalColors). */
  colors: GoalPaletteEntry[];
  /** Errors from the server, keyed like the form fields. */
  serverErrors: GoalFormErrors;
  onSubmit: (values: CreateGoalValues) => void;
};

/**
 * New-goal form. Fields: title, why, progress mode (Milestones | Metric),
 * metric unit and target in Metric mode, start date (today), optional target
 * date, and a color from the goal tokens still free. Inputs are 16px so iOS
 * doesn't zoom, and every control is at least 44px tall.
 */
export default function GoalForm({ id, today, colors, serverErrors, onSubmit }: GoalFormProps) {
  // Lazy initializer: runs when the sheet opens (client only), never during prerender.
  const [state, setState] = useState<GoalFormState>(() =>
    initialGoalForm(today ?? browserToday(), colors[0]?.base ?? ""),
  );
  const [errors, setErrors] = useState<GoalFormErrors>({});
  const shown: GoalFormErrors = { ...serverErrors, ...errors };
  const set = <K extends keyof GoalFormState>(key: K, value: GoalFormState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
    setErrors(({ [key]: _cleared, ...rest }) => rest);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateGoalForm(state);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onSubmit(result.values);
  };

  const metric = state.progressMode === "METRIC";
  return (
    <form id={id} onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field label="Title" error={shown.title}>
        {(fieldId, describedBy) => (
          <input
            id={fieldId}
            aria-describedby={describedBy}
            aria-invalid={shown.title !== undefined}
            className="bc-input min-h-11 text-[16px]"
            value={state.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Run a sub-4 marathon"
            maxLength={200}
            autoComplete="off"
          />
        )}
      </Field>

      <Field label="Why it matters" hint="Optional. You'll see this when the goal stalls." error={shown.why}>
        {(fieldId, describedBy) => (
          <textarea
            id={fieldId}
            aria-describedby={describedBy}
            className="bc-input min-h-[88px] resize-none text-[16px]"
            value={state.why}
            onChange={(e) => set("why", e.target.value)}
            rows={3}
            maxLength={2000}
          />
        )}
      </Field>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="bc-label mb-1.5 text-fg">Track progress by</legend>
        <div role="radiogroup" aria-label="Track progress by" className="grid grid-cols-2 gap-1 rounded-[12px] bg-surface-alt p-1">
          {(["MILESTONES", "METRIC"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={state.progressMode === mode}
              onClick={() => set("progressMode", mode)}
              className={cn(
                "min-h-11 rounded-[10px] text-[15px] font-semibold transition-colors",
                state.progressMode === mode ? "bg-surface text-fg shadow-card" : "text-fg-secondary",
              )}
            >
              {mode === "MILESTONES" ? "Milestones" : "Metric"}
            </button>
          ))}
        </div>
        <p className="bc-caption">
          {metric ? "A number you add to, like 500 km or 12 books." : "Weighted milestones, each made of tasks."}
        </p>
      </fieldset>

      {metric && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target" error={shown.metricTarget}>
            {(fieldId, describedBy) => (
              <input
                id={fieldId}
                aria-describedby={describedBy}
                aria-invalid={shown.metricTarget !== undefined}
                className="bc-input min-h-11 text-[16px]"
                inputMode="decimal"
                type="number"
                min="0"
                step="any"
                value={state.metricTarget}
                onChange={(e) => set("metricTarget", e.target.value)}
                placeholder="500"
              />
            )}
          </Field>
          <Field label="Unit" error={shown.metricUnit}>
            {(fieldId, describedBy) => (
              <input
                id={fieldId}
                aria-describedby={describedBy}
                aria-invalid={shown.metricUnit !== undefined}
                className="bc-input min-h-11 text-[16px]"
                value={state.metricUnit}
                onChange={(e) => set("metricUnit", e.target.value)}
                placeholder="km"
                maxLength={20}
                autoComplete="off"
              />
            )}
          </Field>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Start" error={shown.startDate}>
          {(fieldId, describedBy) => (
            <input
              id={fieldId}
              aria-describedby={describedBy}
              type="date"
              className="bc-input min-h-11 text-[16px]"
              value={state.startDate}
              onChange={(e) => set("startDate", e.target.value)}
              required
            />
          )}
        </Field>
        <Field label="Target date" hint="Optional" error={shown.targetDate}>
          {(fieldId, describedBy) => (
            <input
              id={fieldId}
              aria-describedby={describedBy}
              aria-invalid={shown.targetDate !== undefined}
              type="date"
              className="bc-input min-h-11 text-[16px]"
              value={state.targetDate}
              min={state.startDate}
              onChange={(e) => set("targetDate", e.target.value)}
            />
          )}
        </Field>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="bc-label mb-1.5 text-fg">Color</legend>
        {colors.length === 0 ? (
          <p className="bc-caption">Every color is in use by an active goal.</p>
        ) : (
          <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-1">
            {colors.map((entry) => {
              const selected = state.color === entry.base;
              return (
                <button
                  key={entry.base}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={entry.name}
                  onClick={() => set("color", entry.base)}
                  className="flex size-11 items-center justify-center rounded-full"
                >
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full transition-shadow",
                      selected && "ring-2 ring-offset-2 ring-offset-surface",
                    )}
                    style={{ background: `var(${entry.token})`, ["--tw-ring-color" as string]: `var(${entry.token})` }}
                  >
                    {selected && <Icon icon="complete" size={16} strokeWidth={3} className="text-white" />}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {shown.color !== undefined && <p className="text-[13px] font-medium text-bc-red-dark">{shown.color}</p>}
        <p className="bc-caption">Colors used by your other active goals are hidden.</p>
      </fieldset>
    </form>
  );
}

/** The browser's date, only if the header hasn't filled in the user's day yet. */
function browserToday(): LocalDate {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="bc-label text-fg">
        {label}
      </label>
      {children(id, message === undefined ? undefined : messageId)}
      {message !== undefined && (
        <p id={messageId} className={error === undefined ? "bc-caption" : "text-[13px] font-medium text-bc-red-dark"}>
          {message}
        </p>
      )}
    </div>
  );
}

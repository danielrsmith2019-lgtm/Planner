"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActionFailure } from "@/actions/types";
import BottomSheet from "@/components/shared/BottomSheet";
import { useCreateGoal, useSetGoalStatus, type CreateGoalValues } from "@/hooks/useGoalMutations";
import { freeGoalColors } from "@/lib/domain/goal-colors";
import {
  ACTIVE_GOAL_LIMIT_MESSAGE,
  canActivate,
  countActive,
  groupGoalsByStatus,
  MAX_ACTIVE_GOALS,
  STATUS_LABEL,
} from "@/lib/domain/goal-status";
import type { GoalStatus } from "@/lib/domain/stalled";
import { goalsQuery } from "@/queries/goals";
import type { GoalSummary } from "@/services/day";
import { useUiStore } from "@/stores/ui";
import { Icon } from "@/utils/icons";
import GoalCard from "./GoalCard";
import GoalForm from "./GoalForm";
import { useScheduleNextStep } from "./useScheduleNextStep";
import { fromServerFieldErrors, type GoalFormErrors } from "./goal-form";

const FORM_ID = "new-goal-form";

/** Goals screen: a bento grid of goal cards grouped by status, and the new-goal sheet. */
export default function GoalsView() {
  const goals = useQuery(goalsQuery());
  const today = useUiStore((s) => s.today);
  const timezone = useUiStore((s) => s.timezone);
  const nextStep = useScheduleNextStep(today, timezone);
  const createGoal = useCreateGoal();
  const setStatus = useSetGoalStatus();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<GoalFormErrors>({});

  const list = goals.data ?? [];
  const atLimit = !canActivate(list);

  const openSheet = () => {
    createGoal.reset();
    setFormError(atLimit ? ACTIVE_GOAL_LIMIT_MESSAGE : null);
    setServerErrors({});
    setSheetOpen(true);
  };

  const submit = (values: CreateGoalValues) => {
    setFormError(null);
    setServerErrors({});
    createGoal.mutate(values, {
      onSuccess: () => setSheetOpen(false),
      onError: (error) => {
        if (error instanceof ActionFailure) setServerErrors(fromServerFieldErrors(error.detail.fieldErrors));
        setFormError(error.message);
      },
    });
  };

  const changeStatus = (goal: GoalSummary, status: GoalStatus) => {
    setNotice(null);
    setStatus.mutate(
      { goalId: goal.id, status },
      { onError: (error) => setNotice(error.message) },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="bc-label">
          {goals.isSuccess ? `${countActive(list)} of ${MAX_ACTIVE_GOALS} active` : "Loading goals"}
        </p>
        <button type="button" onClick={openSheet} className="bc-btn-secondary min-h-11 px-4">
          <Icon icon="add" size={18} />
          New goal
        </button>
      </div>

      {(notice ?? nextStep.error) !== null && (
        <div role="alert" className="flex items-start gap-2 rounded-[14px] bg-bc-orange-light py-1 pr-1 pl-4 text-bc-orange-dark">
          <p className="flex-1 py-2.5 text-[14px] font-medium">{notice ?? nextStep.error}</p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              setNotice(null);
              nextStep.clearError();
            }}
            className="flex size-11 shrink-0 items-center justify-center rounded-full"
          >
            <Icon icon="close" size={18} />
          </button>
        </div>
      )}

      {goals.isPending && (
        <div className="bento-grid" aria-hidden="true">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="bc-card bc-skeleton bento-half h-[104px]" />
          ))}
        </div>
      )}

      {goals.isError && (
        <section className="bc-card">
          <p className="bc-section-label">Couldn&apos;t load your goals</p>
          <p className="bc-label mt-2">{goals.error.message}</p>
        </section>
      )}

      {goals.isSuccess && list.length === 0 && (
        <section className="bc-card bc-empty">
          <Icon icon="goals" size={40} className="bc-empty-icon" />
          <p className="bc-empty-title">No goals yet</p>
          <p className="bc-empty-text">What are you working toward? Up to {MAX_ACTIVE_GOALS} active goals at a time.</p>
          <button type="button" onClick={openSheet} className="bc-btn-primary mt-4 min-h-11 w-auto">
            Add your first goal
          </button>
        </section>
      )}

      {groupGoalsByStatus(list).map((section) => (
        <section key={section.status} aria-labelledby={`goals-${section.status}`} className="flex flex-col gap-3">
          <h2 id={`goals-${section.status}`} className="bc-section-label">
            {STATUS_LABEL[section.status]}
          </h2>
          <div className="bento-grid">
            {section.goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onStatusChange={changeStatus}
                onScheduleNextStep={today === null ? undefined : (g) => nextStep.start(g.id)}
                scheduling={nextStep.loadingGoalId === goal.id}
              />
            ))}
          </div>
        </section>
      ))}

      <BottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="New goal"
        primaryAction={{
          label: "Create goal",
          form: FORM_ID,
          disabled: atLimit,
          pending: createGoal.isPending,
          pendingLabel: "Creating...",
        }}
        footerNote={
          formError === null ? undefined : (
            <p role="alert" className="rounded-[10px] bg-bc-red-light px-3 py-2.5 text-[13px] font-medium text-bc-red-dark">
              {formError}
            </p>
          )
        }
      >
        <GoalForm
          id={FORM_ID}
          today={today}
          colors={freeGoalColors(list)}
          serverErrors={serverErrors}
          onSubmit={submit}
        />
      </BottomSheet>

      {nextStep.sheets}
    </div>
  );
}

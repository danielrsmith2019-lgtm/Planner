"use client";

import { useState, type FormEvent } from "react";
import BottomSheet from "@/components/shared/BottomSheet";
import type { NewMilestoneValues } from "@/hooks/useGoalDetailMutations";
import WeightSelector from "./WeightSelector";

const FORM_ID = "add-milestone-form";

export default function AddMilestoneSheet({
  open,
  onOpenChange,
  pending,
  error,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  error: string | null;
  onSubmit: (values: NewMilestoneValues) => void;
}) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="New milestone"
      primaryAction={{ label: "Add milestone", form: FORM_ID, pending, pendingLabel: "Adding..." }}
      footerNote={
        error === null ? undefined : (
          <p role="alert" className="rounded-[10px] bg-bc-red-light px-3 py-2.5 text-[13px] font-medium text-bc-red-dark">
            {error}
          </p>
        )
      }
    >
      {/* Mounted only while open, so each opening starts blank. */}
      {open && <AddMilestoneForm onSubmit={onSubmit} />}
    </BottomSheet>
  );
}

function AddMilestoneForm({ onSubmit }: { onSubmit: (values: NewMilestoneValues) => void }) {
  const [title, setTitle] = useState("");
  const [weight, setWeight] = useState(1);
  const [targetDate, setTargetDate] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (title.trim() === "") {
      setTitleError("Give the milestone a name.");
      return;
    }
    onSubmit({ title: title.trim(), weight, targetDate: targetDate === "" ? null : targetDate });
  };

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="milestone-title" className="bc-label text-fg">
          Title
        </label>
        <input
          id="milestone-title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleError(null);
          }}
          aria-invalid={titleError !== null}
          aria-describedby={titleError === null ? undefined : "milestone-title-error"}
          placeholder="Run a half marathon"
          maxLength={200}
          className="bc-input min-h-11 text-[16px]"
          autoComplete="off"
        />
        {titleError !== null && (
          <p id="milestone-title-error" className="text-[13px] font-medium text-bc-red-dark">
            {titleError}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="bc-label text-fg">Weight</p>
        <WeightSelector value={weight} onChange={setWeight} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="milestone-date" className="bc-label text-fg">
          Target date
        </label>
        <input
          id="milestone-date"
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          className="bc-input min-h-11 text-[16px]"
        />
        <p className="bc-caption">Optional</p>
      </div>
    </form>
  );
}

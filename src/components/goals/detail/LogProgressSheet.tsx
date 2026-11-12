"use client";

import { useState, type FormEvent } from "react";
import BottomSheet from "@/components/shared/BottomSheet";

const FORM_ID = "log-progress-form";

/**
 * Metric goals: ask for an amount (and an optional note). Saving creates an
 * already-DONE task with that contribution, so the goal's total stays the sum
 * of done tasks.
 */
export default function LogProgressSheet({
  open,
  onOpenChange,
  unit,
  current,
  target,
  pending,
  error,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: string;
  current: number;
  target: number | null;
  pending: boolean;
  error: string | null;
  onSubmit: (values: { amount: number; title: string | null }) => void;
}) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Log progress"
      description={target === null ? `${current} ${unit} so far` : `${current} of ${target} ${unit} so far`}
      primaryAction={{ label: "Log it", form: FORM_ID, pending, pendingLabel: "Logging..." }}
      footerNote={
        error === null ? undefined : (
          <p role="alert" className="rounded-[10px] bg-bc-red-light px-3 py-2.5 text-[13px] font-medium text-bc-red-dark">
            {error}
          </p>
        )
      }
    >
      {open && <LogProgressForm unit={unit} onSubmit={onSubmit} />}
    </BottomSheet>
  );
}

function LogProgressForm({
  unit,
  onSubmit,
}: {
  unit: string;
  onSubmit: (values: { amount: number; title: string | null }) => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    if (amount.trim() === "" || !Number.isFinite(value) || value <= 0) {
      setAmountError("Enter an amount above 0.");
      return;
    }
    onSubmit({ amount: value, title: note.trim() === "" ? null : note.trim() });
  };

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="log-amount" className="bc-label text-fg">
          Amount
        </label>
        <div className="flex items-center gap-2">
          <input
            id="log-amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setAmountError(null);
            }}
            aria-invalid={amountError !== null}
            aria-describedby={amountError === null ? undefined : "log-amount-error"}
            placeholder="8"
            className="bc-input min-h-11 flex-1 text-[16px]"
          />
          <span className="bc-label shrink-0 text-fg">{unit}</span>
        </div>
        {amountError !== null && (
          <p id="log-amount-error" className="text-[13px] font-medium text-bc-red-dark">
            {amountError}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="log-note" className="bc-label text-fg">
          Note
        </label>
        <input
          id="log-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={`Logged ${amount === "" ? "8" : amount} ${unit}`}
          maxLength={200}
          className="bc-input min-h-11 text-[16px]"
          autoComplete="off"
        />
        <p className="bc-caption">Optional. Shown in the log below.</p>
      </div>
    </form>
  );
}

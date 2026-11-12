"use client";

import Link from "next/link";
import { useState } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { addDays, formatDayLabel, toDayNumber, type LocalDate } from "@/lib/domain/dates";
import { useUiStore } from "@/stores/ui";
import { Icon } from "@/utils/icons";
import type { AutosaveStatus } from "./autosave";
import JournalEntryEditor, { SaveStatus } from "./JournalEntryEditor";

const isValidDate = (value: string) => {
  try {
    toDayNumber(value);
    return true;
  } catch {
    return false;
  }
};

/**
 * /journal/[date]. Phones (<768px): full screen over the app shell, with the
 * formatting toolbar pinned above the keyboard. Desktop: a normal page with
 * previous / next day links.
 */
export default function JournalDayView({ date }: { date: string }) {
  const desktop = useMediaQuery("(min-width: 768px)");
  const today = useUiStore((s) => s.today);
  const [status, setStatus] = useState<AutosaveStatus>({ state: "idle" });

  if (!isValidDate(date)) {
    return (
      <section className="bc-card">
        <p className="bc-section-label">That isn&apos;t a date</p>
        <Link href="/journal" className="bc-label mt-2 inline-flex min-h-11 items-center text-bc-blue">
          Back to the journal
        </Link>
      </section>
    );
  }
  const label = date === today ? `Today, ${formatDayLabel(date, { short: true })}` : formatDayLabel(date);

  if (!desktop) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-surface pt-[var(--safe-top)]">
        <header className="flex h-14 shrink-0 items-center gap-1 border-b border-border px-1">
          <Link href="/journal" aria-label="Back to journal" className="flex size-11 items-center justify-center rounded-full text-bc-blue">
            <Icon icon="previous" size={22} />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-[16px] font-semibold text-fg">{label}</h1>
          <SaveStatus status={status} className="pr-3" />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-4">
          <JournalEntryEditor date={date} toolbar="keyboard" onStatus={setStatus} />
        </div>
      </div>
    );
  }

  return <DesktopDay date={date as LocalDate} label={label} status={status} onStatus={setStatus} />;
}

function DesktopDay({
  date,
  label,
  status,
  onStatus,
}: {
  date: LocalDate;
  label: string;
  status: AutosaveStatus;
  onStatus: (status: AutosaveStatus) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Link href="/journal" className="-ml-2 flex min-h-11 w-fit items-center gap-1 pr-3 pl-1 text-[15px] font-medium text-bc-blue">
        <Icon icon="previous" size={20} />
        Journal
      </Link>
      <div className="flex items-center gap-1">
        <Link href={`/journal/${addDays(date, -1)}`} aria-label="Previous day" className="flex size-11 items-center justify-center rounded-full text-fg-secondary hover:bg-surface">
          <Icon icon="previous" size={20} />
        </Link>
        <h1 className="min-w-0 flex-1 text-[22px] font-bold tracking-tight text-fg">{label}</h1>
        <SaveStatus status={status} className="px-2" />
        <Link href={`/journal/${addDays(date, 1)}`} aria-label="Next day" className="flex size-11 items-center justify-center rounded-full text-fg-secondary hover:bg-surface">
          <Icon icon="next" size={20} />
        </Link>
      </div>
      <section className="bc-card px-5 py-4">
        <JournalEntryEditor date={date} onStatus={onStatus} />
      </section>
    </div>
  );
}

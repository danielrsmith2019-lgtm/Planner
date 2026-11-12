"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDayLabel, type LocalDate } from "@/lib/domain/dates";
import { Icon } from "@/utils/icons";
import type { AutosaveStatus } from "./autosave";
import JournalEntryEditor, { SaveStatus } from "./JournalEntryEditor";

/** The right pane of /today on desktop: the selected day's journal entry. */
export default function JournalPane({ date }: { date: LocalDate }) {
  const [status, setStatus] = useState<AutosaveStatus>({ state: "idle" });
  return (
    <section aria-labelledby="journal-pane-title" className="bc-card px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <h2 id="journal-pane-title" className="bc-section-label">
          Reflection
        </h2>
        <SaveStatus status={status} className="ml-auto" />
        <Link
          href={`/journal/${date}`}
          aria-label={`Open the ${formatDayLabel(date, { short: true })} entry on its own page`}
          className="-mr-2 flex size-11 items-center justify-center rounded-full text-fg-tertiary hover:text-bc-blue"
        >
          <Icon icon="next" size={18} />
        </Link>
      </div>
      <JournalEntryEditor date={date} onStatus={setStatus} />
    </section>
  );
}

/** Below 1024px Today has no room for the pane; this links to the full-screen entry instead. */
export function JournalLinkCard({ date, isToday }: { date: LocalDate; isToday: boolean }) {
  return (
    <Link href={`/journal/${date}`} className="bc-card flex min-h-14 items-center gap-3 py-3">
      <Icon icon="journal" size={20} className="shrink-0 text-bc-blue" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-fg">{isToday ? "How did today go?" : "Journal"}</span>
        <span className="bc-caption block">Reflection, tomorrow&apos;s intention and mood</span>
      </span>
      <Icon icon="next" size={18} className="shrink-0 text-fg-tertiary" />
    </Link>
  );
}

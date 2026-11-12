"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/utils/icons";

/** Inline "Add task": Enter or the + button creates a backlog task in this milestone. */
export default function AddTaskRow({
  milestoneTitle,
  pending,
  onAdd,
}: {
  milestoneTitle: string;
  pending: boolean;
  onAdd: (title: string, done: () => void) => void;
}) {
  const [title, setTitle] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (trimmed === "" || pending) return;
    onAdd(trimmed, () => setTitle(""));
  };
  return (
    <form onSubmit={submit} className="flex items-center gap-1">
      <span className="flex size-11 shrink-0 items-center justify-center text-fg-tertiary" aria-hidden="true">
        <Icon icon="add" size={18} />
      </span>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add task"
        aria-label={`Add a task to ${milestoneTitle}`}
        maxLength={200}
        className="min-h-11 min-w-0 flex-1 bg-transparent text-[16px] text-fg outline-none placeholder:text-fg-tertiary"
      />
      {title.trim() !== "" && (
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 shrink-0 rounded-[10px] px-3 text-[15px] font-semibold text-bc-blue disabled:opacity-50"
        >
          {pending ? "Adding" : "Add"}
        </button>
      )}
    </form>
  );
}

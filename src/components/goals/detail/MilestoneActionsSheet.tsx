"use client";

import BottomSheet from "@/components/shared/BottomSheet";
import { isReadyToClose, type MilestoneDetail } from "@/lib/domain/goal-detail";
import { Icon } from "@/utils/icons";
import WeightSelector from "./WeightSelector";

/** A milestone's actions: weight 1-3 and close / reopen. Bottom sheet on phones, dialog on desktop. */
export default function MilestoneActionsSheet({
  milestone,
  onOpenChange,
  onWeight,
  onStatus,
}: {
  milestone: MilestoneDetail | null;
  onOpenChange: (open: boolean) => void;
  onWeight: (milestone: MilestoneDetail, weight: number) => void;
  onStatus: (milestone: MilestoneDetail, status: "OPEN" | "DONE") => void;
}) {
  const done = milestone?.status === "DONE";
  const openTasks = milestone?.counts.todo ?? 0;
  return (
    <BottomSheet
      open={milestone !== null}
      onOpenChange={onOpenChange}
      title={milestone?.title ?? "Milestone"}
      primaryAction={
        milestone === null
          ? undefined
          : {
              label: done ? "Reopen milestone" : "Mark milestone complete",
              onClick: () => onStatus(milestone, done ? "OPEN" : "DONE"),
            }
      }
      footerNote={
        milestone !== null && !done && !isReadyToClose(milestone) && openTasks > 0 ? (
          <p className="bc-caption">
            {openTasks} {openTasks === 1 ? "task is" : "tasks are"} still open. You can still close it.
          </p>
        ) : undefined
      }
    >
      {milestone !== null && (
        <div className="flex flex-col gap-2">
          <p className="bc-label text-fg">Weight</p>
          <WeightSelector value={milestone.weight} onChange={(weight) => onWeight(milestone, weight)} />
          <p className="bc-caption flex items-start gap-1.5">
            <Icon icon="goals" size={14} className="mt-0.5 shrink-0" />
            Heavier milestones count for more of the goal&apos;s progress.
          </p>
        </div>
      )}
    </BottomSheet>
  );
}

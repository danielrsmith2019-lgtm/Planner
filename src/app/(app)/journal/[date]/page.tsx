import { Suspense } from "react";
import JournalDayView from "@/components/journal/JournalDayView";

export const metadata = { title: "Journal | Planner" };

/** One day's entry. params is request data, so it's read inside Suspense. */
export default function JournalDayPage({ params }: PageProps<"/journal/[date]">) {
  return (
    <Suspense fallback={<div className="bc-card bc-skeleton h-64" aria-hidden="true" />}>
      <JournalDayLoader params={params} />
    </Suspense>
  );
}

async function JournalDayLoader({ params }: { params: PageProps<"/journal/[date]">["params"] }) {
  const { date } = await params;
  return <JournalDayView date={date} />;
}

import { Suspense } from "react";
import JournalDayView from "@/components/journal/JournalDayView";

export const metadata = { title: "Journal | Planner" };

/** One day's entry. params is request data, so it's read inside Suspense. */
export default function JournalDayPage({ params, searchParams }: PageProps<"/journal/[date]">) {
  return (
    <Suspense fallback={<div className="bc-card bc-skeleton h-64" aria-hidden="true" />}>
      <JournalDayLoader params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function JournalDayLoader({
  params,
  searchParams,
}: Pick<PageProps<"/journal/[date]">, "params" | "searchParams">) {
  const { date } = await params;
  // ?block=<UniqueID> (from a goal's Reflections) scrolls to that block.
  const { block } = await searchParams;
  return <JournalDayView date={date} focusBlockId={typeof block === "string" ? block : null} />;
}

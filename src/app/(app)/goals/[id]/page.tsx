import { Suspense } from "react";
import GoalDetailView from "@/components/goals/detail/GoalDetailView";

export const metadata = { title: "Goal | Planner" };

/**
 * Goal detail. params is request data, so it's read inside Suspense
 * (cacheComponents); the goal itself loads on the client via ['goal', id].
 */
export default function GoalDetailPage({ params }: PageProps<"/goals/[id]">) {
  return (
    <Suspense fallback={<div className="bc-card bc-skeleton h-36" aria-hidden="true" />}>
      <GoalDetailLoader params={params} />
    </Suspense>
  );
}

async function GoalDetailLoader({ params }: { params: PageProps<"/goals/[id]">["params"] }) {
  const { id } = await params;
  return <GoalDetailView goalId={id} />;
}

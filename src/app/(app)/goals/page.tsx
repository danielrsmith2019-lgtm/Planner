import GoalsView from "@/components/goals/GoalsView";

export const metadata = { title: "Goals | Planner" };

// Data loads on the client through TanStack Query (['goals']), so this page
// stays static and the shell renders instantly.
export default function GoalsPage() {
  return <GoalsView />;
}

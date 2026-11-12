import TodayView from "@/components/planner/TodayView";

export const metadata = { title: "Today | Planner" };

// List version of Today (Top 3, Today, Backlog). Data loads on the client
// through ['day', selectedDate]; the timeline replaces the middle on Day 16.
export default function TodayPage() {
  return <TodayView />;
}

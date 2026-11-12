import WeekView from "@/components/week/WeekView";

export const metadata = { title: "Week | Planner" };

// Seven columns on desktop, day sections on phones. Loads ['week', monday]
// on the client; the header arrows move a week at a time.
export default function WeekPage() {
  return <WeekView />;
}

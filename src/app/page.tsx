import { redirect } from "next/navigation";

// The app opens on Today.
export default function RootPage() {
  redirect("/today");
}

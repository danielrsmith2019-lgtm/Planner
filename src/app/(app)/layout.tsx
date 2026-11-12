import type { ReactNode } from "react";
import AppShell from "@/components/shell/AppShell";

// Every signed-in route lives in this group; /login and /signup sit outside it.
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

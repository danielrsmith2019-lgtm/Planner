import type { ReactNode } from "react";
import Providers from "@/app/providers";
import AppShell from "@/components/shell/AppShell";

// Every signed-in route lives in this group; /login and /signup sit outside it.
// Providers (TanStack Query) wrap the shell so every page can use queries.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <AppShell>{children}</AppShell>
    </Providers>
  );
}

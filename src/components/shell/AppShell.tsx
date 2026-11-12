import { Suspense, type ReactNode } from "react";
import BottomTabs from "./BottomTabs";
import HeaderLoader, { HeaderSkeleton } from "./HeaderLoader";
import QuickAddSheet from "./QuickAddSheet";
import Sidebar from "./Sidebar";

/**
 * The signed-in app frame (blueprint Section 4, "App shell").
 *   <768px:     header + bottom tabs
 *   768-1023px: header + 72px icon rail
 *   >=1024px:   header + 240px sidebar
 * Switching is CSS-only, so there's no layout flash on load.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Sidebar />
      <Suspense fallback={<HeaderSkeleton />}>
        <HeaderLoader />
      </Suspense>
      <main className="min-h-dvh bg-canvas pb-[calc(64px+var(--safe-bottom)+24px)] pt-[calc(56px+var(--safe-top))] md:pb-10 md:pl-[72px] lg:pl-60">
        <div className="mx-auto w-full max-w-5xl px-4 py-5 md:px-6 md:py-6">{children}</div>
      </main>
      <BottomTabs />
      <QuickAddSheet />
    </>
  );
}

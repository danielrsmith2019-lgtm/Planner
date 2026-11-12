import type { ReactNode } from "react";

/**
 * Full-height frame for /login and /signup: wordmark and tagline above a
 * white card. On phones the card fills the width; on larger screens it's
 * a centered 400px column.
 */
export default function AuthShell({ tagline, children, footer }: { tagline: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col bg-canvas px-4 pb-[calc(24px+var(--safe-bottom))] pt-[calc(48px+var(--safe-top))] sm:items-center sm:justify-center sm:py-12">
      <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col sm:flex-none">
        <header className="mb-8 text-center">
          <h1 className="bc-wordmark justify-center text-[32px] font-bold">Planner</h1>
          <p className="bc-label mt-2">{tagline}</p>
        </header>
        <div className="bc-card flex flex-col gap-5 px-5 py-6">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-fg-secondary">{footer}</div>}
      </div>
    </main>
  );
}

/** Placeholder while the form loads (it reads the URL on the client). */
export function AuthShellSkeleton() {
  return (
    <AuthShell tagline="The daily planner that knows what your goals are.">
      <div className="bc-skeleton h-11" />
      <div className="bc-skeleton h-4 w-1/3 self-center" />
      <div className="bc-skeleton h-11" />
      <div className="bc-skeleton h-11" />
      <div className="bc-skeleton h-11" />
    </AuthShell>
  );
}

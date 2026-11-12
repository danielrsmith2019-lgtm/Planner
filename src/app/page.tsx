import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getLocalToday } from "@/lib/domain/dates";
import { Icon } from "@/utils/icons";

/**
 * Placeholder home until the Today screen exists (Iteration 2). It proves the
 * auth loop end to end: proxy -> session -> Prisma User -> user's local day.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[400px] flex-col justify-center gap-4 px-4 py-12">
      <h1 className="bc-wordmark text-[28px] font-bold">Planner</h1>
      <Suspense fallback={<div className="bc-card bc-skeleton h-36" />}>
        <SignedInCard />
      </Suspense>
    </main>
  );
}

async function SignedInCard() {
  const user = await getCurrentUser();
  const today = getLocalToday(user, new Date());

  return (
    <section className="bc-card flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="bc-section-label">Signed in</span>
        <span className="bc-section-title">{user.name ?? user.email}</span>
        <span className="bc-label">{user.email}</span>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="bc-caption">Today</dt>
          <dd className="bc-data mt-1">{today}</dd>
        </div>
        <div>
          <dt className="bc-caption">Timezone</dt>
          <dd className="bc-data mt-1 truncate">{user.timezone}</dd>
        </div>
      </dl>
      <form action="/auth/signout" method="post">
        <button type="submit" className="bc-btn-secondary min-h-11 w-full">
          <Icon icon="signOut" size={16} />
          Sign out
        </button>
      </form>
    </section>
  );
}

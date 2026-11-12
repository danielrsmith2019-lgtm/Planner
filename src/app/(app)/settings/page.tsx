import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Icon } from "@/utils/icons";

export const metadata = { title: "Settings | Planner" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="bc-card bc-skeleton h-40" aria-hidden="true" />}>
      <AccountCard />
    </Suspense>
  );
}

async function AccountCard() {
  const user = await getCurrentUser();
  const dayStart = `${Math.floor(user.dayStartsAt / 60)}:${String(user.dayStartsAt % 60).padStart(2, "0")} AM`;

  return (
    <section className="bc-card flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="bc-section-label">Account</span>
        <h1 className="bc-section-title">{user.name ?? user.email}</h1>
        <span className="bc-label">{user.email}</span>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="bc-caption">Timezone</dt>
          <dd className="bc-data mt-1 truncate">{user.timezone}</dd>
        </div>
        <div>
          <dt className="bc-caption">Day starts</dt>
          <dd className="bc-data mt-1">{dayStart}</dd>
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

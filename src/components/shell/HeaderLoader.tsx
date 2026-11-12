import { getCurrentUser } from "@/lib/auth/current-user";
import Header, { HeaderFrame } from "./Header";

function initialsOf(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Server side of the header: loads the user, then hands the client header what it needs. */
export default async function HeaderLoader() {
  const user = await getCurrentUser();
  return <Header user={{ timezone: user.timezone, dayStartsAt: user.dayStartsAt, initials: initialsOf(user.name, user.email) }} />;
}

export function HeaderSkeleton() {
  return (
    <HeaderFrame>
      <div className="bc-skeleton ml-2 h-8 w-44" aria-hidden="true" />
    </HeaderFrame>
  );
}

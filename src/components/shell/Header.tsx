"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { getLocalMinute, getLocalToday } from "@/lib/domain/dates";
import { getDefaultMode } from "@/lib/domain/mode";
import { useUiStore } from "@/stores/ui";
import { Icon } from "@/utils/icons";
import DateNav from "./DateNav";
import ModeChip from "./ModeChip";
import { getHeaderConfig } from "./nav";

export type HeaderUser = { timezone: string; dayStartsAt: number; initials: string };

/**
 * Fixed frosted header (56px + safe area). Syncs the store's clock from the
 * user's timezone on load and whenever the tab becomes visible again, so
 * "today" and the default mode stay right across midnight and day starts.
 */
export default function Header({ user }: { user: HeaderUser }) {
  const pathname = usePathname();
  const config = getHeaderConfig(pathname);
  const syncClock = useUiStore((s) => s.syncClock);

  useEffect(() => {
    const sync = () => {
      const now = new Date();
      syncClock({
        today: getLocalToday(user, now),
        defaultMode: getDefaultMode(getLocalMinute(user.timezone, now), user.dayStartsAt),
      });
    };
    sync();
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user, syncClock]);

  return (
    <HeaderFrame>
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {config.dateNav ? <DateNav step={config.dateStep} /> : <h2 className="bc-section-title pl-1">{config.title}</h2>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {config.modeChip && <ModeChip />}
        <Link
          href="/settings"
          aria-label="Settings"
          className={`flex size-11 items-center justify-center ${config.modeChip ? "max-sm:hidden" : ""}`}
        >
          <span className="bc-avatar size-8 text-[12px]">{user.initials || <Icon icon="settings" size={16} />}</span>
        </Link>
      </div>
    </HeaderFrame>
  );
}

/** Shared frame, also used by the loading placeholder. */
export function HeaderFrame({ children }: { children: ReactNode }) {
  return (
    <header className="bc-header gap-2 px-2 max-[379px]:gap-1 max-[379px]:px-1 md:left-[72px] md:px-4 lg:left-60 lg:px-6">{children}</header>
  );
}

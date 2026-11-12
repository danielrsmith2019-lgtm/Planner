"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useUiStore } from "@/stores/ui";
import { Icon } from "@/utils/icons";
import { TAB_ITEMS_LEFT, TAB_ITEMS_RIGHT, isActivePath, type NavItem } from "./nav";

/** Phone navigation (<768px): Today, Week, raised Quick add, Journal, Goals. */
export default function BottomTabs() {
  // usePathname is request data on dynamic routes (/goals/[id]), so with
  // cacheComponents it must sit inside Suspense. The fallback is the same nav
  // with nothing highlighted; static routes resolve it at build time.
  return (
    <Suspense fallback={<BottomTabsFrame pathname={null} />}>
      <BottomTabsWithPathname />
    </Suspense>
  );
}

function BottomTabsWithPathname() {
  return <BottomTabsFrame pathname={usePathname()} />;
}

function BottomTabsFrame({ pathname }: { pathname: string | null }) {
  const openQuickAdd = useUiStore((s) => s.openQuickAdd);

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border pb-[var(--safe-bottom)] md:hidden"
      style={{ background: "rgba(255, 255, 255, 0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
    >
      <div className="grid h-16 grid-cols-5 items-stretch">
        {TAB_ITEMS_LEFT.map((item) => (
          <Tab key={item.href} item={item} active={pathname !== null && isActivePath(pathname, item.href)} />
        ))}
        <div className="flex items-start justify-center">
          <button
            type="button"
            onClick={openQuickAdd}
            aria-label="Quick add"
            className="-mt-5 flex size-14 items-center justify-center rounded-full bg-bc-blue text-white shadow-float ring-4 ring-canvas transition-transform active:scale-95"
          >
            <Icon icon="add" size={26} strokeWidth={2.5} />
          </button>
        </div>
        {TAB_ITEMS_RIGHT.map((item) => (
          <Tab key={item.href} item={item} active={pathname !== null && isActivePath(pathname, item.href)} />
        ))}
      </div>
    </nav>
  );
}

function Tab({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-11 flex-col items-center justify-center gap-0.5 transition-colors ${
        active ? "text-bc-blue" : "text-fg-tertiary"
      }`}
    >
      {active && <span className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full bg-bc-blue" />}
      <Icon icon={item.icon} size={22} strokeWidth={active ? 2.25 : 1.75} />
      <span className={`text-[10px] ${active ? "font-semibold" : "font-medium"}`}>{item.label}</span>
    </Link>
  );
}

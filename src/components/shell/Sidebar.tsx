"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useUiStore } from "@/stores/ui";
import { Icon } from "@/utils/icons";
import { NAV_ITEMS, isActivePath } from "./nav";

/**
 * Desktop and tablet navigation (hidden on phones, which use BottomTabs).
 *   768-1023px: 72px icon rail, labels in tooltips
 *   >=1024px:   240px frosted sidebar with icons and labels
 */
export default function Sidebar() {
  // usePathname is request data on dynamic routes (/goals/[id]), so with
  // cacheComponents it must sit inside Suspense. The fallback is the same nav
  // with nothing highlighted; static routes resolve it at build time.
  return (
    <Suspense fallback={<SidebarFrame pathname={null} />}>
      <SidebarWithPathname />
    </Suspense>
  );
}

function SidebarWithPathname() {
  return <SidebarFrame pathname={usePathname()} />;
}

function SidebarFrame({ pathname }: { pathname: string | null }) {
  const openQuickAdd = useUiStore((s) => s.openQuickAdd);

  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 hidden w-[72px] flex-col border-r border-border pt-[var(--safe-top)] md:flex lg:w-60"
      style={{ background: "rgba(255, 255, 255, 0.82)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
    >
      <div className="flex h-14 items-center justify-center px-3 lg:justify-start lg:px-5">
        <span className="flex size-9 items-center justify-center rounded-[10px] bg-bc-blue text-[17px] font-bold text-white lg:hidden">
          P
        </span>
        <span className="bc-wordmark hidden font-bold lg:flex">Planner</span>
      </div>

      <div className="px-3 pb-2 pt-3 lg:px-4">
        <button
          type="button"
          onClick={openQuickAdd}
          aria-label="Quick add"
          title="Quick add"
          className="mx-auto flex size-12 items-center justify-center gap-2 rounded-full bg-bc-blue text-white shadow-float transition-opacity hover:opacity-90 lg:h-11 lg:w-full lg:rounded-[10px] lg:shadow-none"
        >
          <Icon icon="add" size={22} />
          <span className="hidden text-[15px] font-semibold lg:inline">Quick add</span>
        </button>
      </div>

      <nav aria-label="Main" className="flex flex-col gap-1 px-3 py-2 lg:px-4">
        {NAV_ITEMS.map((item) => {
          const active = pathname !== null && isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              title={item.label}
              className={`flex min-h-12 items-center justify-center gap-3 rounded-[10px] text-[15px] font-medium transition-colors lg:min-h-11 lg:justify-start lg:px-3 ${
                active ? "bg-bc-blue/10 font-semibold text-bc-blue" : "text-fg-secondary hover:bg-surface-alt hover:text-fg"
              }`}
            >
              <Icon icon={item.icon} size={22} strokeWidth={active ? 2.25 : 1.75} />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

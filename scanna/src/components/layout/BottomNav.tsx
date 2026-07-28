"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { CameraIcon, SearchIcon, CollectionIcon, ListingsIcon, DashboardIcon } from "@/components/ui/icons";

const NAV_ITEMS = [
  { href: "/scan", label: "Scan", Icon: CameraIcon },
  { href: "/research", label: "Research", Icon: SearchIcon },
  { href: "/collection", label: "Collection", Icon: CollectionIcon },
  { href: "/listings", label: "Listings", Icon: ListingsIcon },
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
];

/** Bottom tab bar on mobile (< lg), left sidebar from lg: up — per
 * design-spec.md. Large touch targets (min 44x44) throughout. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="contents">
      {/* Mobile / tablet: fixed bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-paper lg:hidden">
        <ul className="flex">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-xs font-medium",
                    active ? "text-ink" : "text-ink-50",
                  )}
                >
                  <Icon className={cn("h-6 w-6", active && "text-gold")} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Desktop: fixed left sidebar */}
      <div className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-border bg-paper lg:flex">
        <div className="px-5 py-6">
          <span className="font-heading text-xl font-semibold text-ink">Scanna</span>
        </div>
        <ul className="flex flex-1 flex-col gap-1 px-3">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-[44px] items-center gap-3 rounded-lg border-l-4 px-3 text-sm font-medium",
                    active
                      ? "border-gold bg-bone-100 text-ink"
                      : "border-transparent text-ink-70 hover:bg-bone-100",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

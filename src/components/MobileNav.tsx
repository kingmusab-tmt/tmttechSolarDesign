"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoutButton } from "./LogoutButton";
import { cx } from "./ui";

export interface NavLink {
  href: string;
  label: string;
  badge?: number;
  accent?: boolean;
}

/** Hamburger menu for small screens: a full-width drawer under the header. */
export function MobileNav({ links, userName, signedIn }: { links: NavLink[]; userName?: string; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on navigation, and on Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const totalBadge = links.reduce((a, l) => a + (l.badge ?? 0), 0);

  return (
    <div className="lg:hidden">
      <button data-tour="nav-mobile" className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((v) => !v)}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
        {!open && totalBadge > 0 && <span className="absolute -top-1 -right-1 rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">{totalBadge}</span>}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-40 bg-black/30" onClick={() => setOpen(false)} aria-hidden="true" />
          <nav id="mobile-menu" className="fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-50 max-h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] overflow-y-auto border-b border-line bg-surface px-3 pt-2 pb-4 shadow-lg">
            <ul className="space-y-1">
              {links.map((l) => {
                const active = pathname === l.href || (l.href !== "/" && pathname.startsWith(`${l.href}/`));
                return (
                  <li key={l.href}>
                    <Link href={l.href} className={cx("flex items-center justify-between rounded-lg px-3 py-3 text-base", active ? "bg-accent-soft font-semibold text-accent-strong" : "hover:bg-surface-2", l.accent && !active && "font-medium text-accent-strong")}>
                      {l.label}
                      {l.badge ? <span className="rounded-full bg-accent px-2 text-xs font-bold text-white">{l.badge}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 border-t border-line pt-3">
              {signedIn ? (
                <div className="flex items-center justify-between gap-3 px-3">
                  <Link href="/account" className="min-w-0 truncate text-sm text-muted">
                    {userName} · Account
                  </Link>
                  <LogoutButton />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 px-3">
                  <Link href="/login" className="btn">
                    Sign in
                  </Link>
                  <Link href="/register" className="btn btn-primary">
                    Get started
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}

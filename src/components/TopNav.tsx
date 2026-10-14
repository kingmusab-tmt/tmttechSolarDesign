import Link from "next/link";
import { APP_NAME } from "@/lib/brand";
import { getSession } from "@/lib/server/auth";
import { connectDB } from "@/lib/server/db";
import { ChangeRequest } from "@/models/ChangeRequest";
import { User } from "@/models/User";
import { LogoutButton } from "./LogoutButton";
import { Logo } from "./Logo";
import { MobileNav, type NavLink } from "./MobileNav";
import { ThemeToggle } from "./ThemeToggle";

const LINK = "rounded-md px-2.5 py-1.5 whitespace-nowrap text-muted hover:bg-surface-2 hover:text-text";

/** Role and approval count, best effort: the nav must still render if the database is unreachable. */
async function navContext(userId: string) {
  try {
    await connectDB();
    const [user, pending] = await Promise.all([
      User.findById(userId, { role: 1 }).lean(),
      ChangeRequest.countDocuments({ approvers: userId, status: "pending", proposedBy: { $ne: userId } }),
    ]);
    return { isAdmin: user?.role === "admin", pending };
  } catch {
    return { isAdmin: false, pending: 0 };
  }
}

export async function TopNav() {
  const session = await getSession();
  const ctx = session ? await navContext(session.userId) : { isAdmin: false, pending: 0 };
  const links: NavLink[] = session
    ? [
        { href: "/dashboard", label: "Projects" },
        { href: "/equipment", label: "Equipment" },
        { href: "/orgs", label: "Organisations" },
        { href: "/approvals", label: "Approvals", badge: ctx.pending || undefined },
        { href: "/calculator", label: "Quick calc" },
        ...(ctx.isAdmin ? [{ href: "/admin", label: "Admin", accent: true }] : []),
      ]
    : [{ href: "/calculator", label: "Quick calc" }];

  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
        <Link href={session ? "/dashboard" : "/"} className="flex shrink-0 items-center gap-2 font-semibold">
          <Logo className="h-7 w-7" />
          <span>{APP_NAME}</span>
        </Link>

        {/* Desktop / tablet: inline links */}
        <nav className="hidden min-w-0 flex-1 items-center gap-1 text-sm lg:flex">
          {links.map((l) => (
            <Link key={l.href} className={`${LINK} ${l.accent ? "font-medium text-accent-strong" : ""}`} href={l.href}>
              {l.label}
              {l.badge ? <span className="ml-1 rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">{l.badge}</span> : null}
            </Link>
          ))}
        </nav>
        <div className="hidden shrink-0 items-center gap-3 text-sm lg:flex">
          <ThemeToggle />
          {session ? (
            <>
              <Link href="/account" className="max-w-40 truncate text-muted hover:text-text" title="Account settings">
                {session.name}
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-sm whitespace-nowrap">
                Sign in
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm">
                Get started
              </Link>
            </>
          )}
        </div>

        {/* Phones: hamburger menu */}
        <div className="ml-auto flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <MobileNav links={links} userName={session?.name} signedIn={Boolean(session)} />
        </div>
      </div>
    </header>
  );
}

import Link from "next/link";
import { getSession } from "@/lib/server/auth";
import { connectDB } from "@/lib/server/db";
import { ChangeRequest } from "@/models/ChangeRequest";
import { User } from "@/models/User";
import { LogoutButton } from "./LogoutButton";
import { Logo } from "./Logo";

const LINK = "rounded-md px-2 py-1.5 whitespace-nowrap sm:px-2.5 text-muted hover:bg-surface-2 hover:text-text";

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
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-3 sm:gap-4 sm:px-6">
        <Link href={session ? "/dashboard" : "/"} className="flex shrink-0 items-center gap-2 font-semibold">
          <Logo className="h-7 w-7" />
          <span className="hidden lg:inline">SolarDesign Pro</span>
        </Link>
        <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto text-sm sm:gap-1">
          {session && (
            <>
              <Link className={LINK} href="/dashboard">
                Projects
              </Link>
              <Link className={LINK} href="/equipment">
                Equipment
              </Link>
              <Link className={LINK} href="/orgs">
                Organisations
              </Link>
              <Link className={LINK} href="/approvals">
                Approvals
                {ctx.pending > 0 && <span className="ml-1 rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">{ctx.pending}</span>}
              </Link>
            </>
          )}
          <Link className={LINK} href="/calculator">
            Quick calc
          </Link>
          {ctx.isAdmin && (
            <Link className={`${LINK} font-medium text-accent-strong`} href="/admin">
              Admin
            </Link>
          )}
        </nav>
        <div className="flex shrink-0 items-center gap-3 text-sm">
          {session ? (
            <>
              <Link href="/account" className="text-muted hover:text-text" title="Account settings">
                <span className="hidden md:inline">{session.name}</span>
                <span className="md:hidden" aria-label="Account">
                  Account
                </span>
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
      </div>
    </header>
  );
}

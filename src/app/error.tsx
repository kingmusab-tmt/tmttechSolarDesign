"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">
        {typeof navigator !== "undefined" && !navigator.onLine ? "You appear to be offline. Reconnect and try again." : "An unexpected error occurred. Your saved work is safe."}
      </p>
      {error.digest && <p className="mt-1 font-mono text-xs text-muted">Ref: {error.digest}</p>}
      <div className="mt-6 flex justify-center gap-2">
        <button className="btn btn-primary" onClick={reset}>
          Try again
        </button>
        <Link className="btn" href="/dashboard">
          Back to projects
        </Link>
      </div>
    </main>
  );
}

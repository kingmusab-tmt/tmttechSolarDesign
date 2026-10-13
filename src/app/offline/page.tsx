import Link from "next/link";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="text-5xl">📡</div>
      <h1 className="mt-4 text-2xl font-bold">You&apos;re offline</h1>
      <p className="mt-2 text-sm text-muted">This page needs a connection. Your project changes are queued and sync automatically when you&apos;re back online. Meanwhile, the quick calculator works offline.</p>
      <Link href="/calculator" className="btn btn-primary mt-6">
        Open quick calculator
      </Link>
    </main>
  );
}

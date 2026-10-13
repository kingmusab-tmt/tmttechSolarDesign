import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">Not found</h1>
      <p className="mt-2 text-sm text-muted">This page or project doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link href="/dashboard" className="btn btn-primary mt-6">
        Back to projects
      </Link>
    </main>
  );
}

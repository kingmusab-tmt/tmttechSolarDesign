"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ProjectActions({ id, name, canDelete = true }: { id: string; name: string; canDelete?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function duplicate() {
    setBusy(true);
    const res = await fetch(`/api/projects/${id}/duplicate`, { method: "POST" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  async function remove() {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setBusy(true);
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex gap-1.5">
      <button className="btn btn-sm" onClick={duplicate} disabled={busy} title="Duplicate">
        Copy
      </button>
      {canDelete && (
        <button className="btn btn-sm text-bad" onClick={remove} disabled={busy} title="Delete">
          Delete
        </button>
      )}
      <Link className="btn btn-primary btn-sm" href={`/projects/${id}`}>
        Open
      </Link>
    </div>
  );
}

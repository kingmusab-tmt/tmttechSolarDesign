"use client";

import { useCallback, useEffect, useState } from "react";
import { fmt, moneyCompact, timeAgo } from "@/lib/format";
import { revisionLabel } from "@/lib/revision-label";
import { Card } from "../ui";
import { useProject } from "./ProjectProvider";

export interface RevisionSummary {
  _id: string;
  number: number;
  label: string;
  note: string;
  summary: { arrayKWp?: number; inverterKW?: number; batteryKWh?: number; capex?: number };
  createdAt: string;
}

export function useRevisions(projectId: string) {
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/revisions`);
      if (res.ok) setRevisions((await res.json()).revisions);
    } finally {
      setLoaded(true);
    }
  }, [projectId]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { revisions, loaded, reload };
}

export function RevisionsCard() {
  const { project, flush, collab } = useProject();
  const { revisions, loaded, reload } = useRevisions(project._id);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function issue(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await flush(); // snapshot what the engineer currently sees
      const res = await fetch(`/api/projects/${project._id}/revisions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not issue revision");
      setNote("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not issue revision");
    } finally {
      setBusy(false);
    }
  }

  async function restore(r: RevisionSummary) {
    if (!confirm(`Restore Rev ${r.label}? The current design inputs will be replaced. Issue a revision first if you want to keep them.`)) return;
    setBusy(true);
    await flush();
    const res = await fetch(`/api/projects/${project._id}/revisions/${r._id}`, { method: "POST" });
    if (!res.ok) {
      setBusy(false);
      return setError((await res.json().catch(() => ({}))).error || "Restore failed");
    }
    try {
      localStorage.removeItem(`shs-pending:${project._id}`);
    } catch {}
    window.location.reload();
  }

  return (
    <Card title="Design revisions" subtitle="Issue an immutable snapshot when you send the design out (Rev A, B, …). Restore one at any time.">
      <form onSubmit={issue} className="flex flex-wrap gap-2">
        <input className="input min-w-0 flex-1" placeholder="Revision note, e.g. Issued for client approval" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
        <button className="btn btn-primary" disabled={busy}>
          Issue Rev {revisionLabel((revisions[0]?.number ?? 0) + 1)}
        </button>
      </form>
      {error && <p className="mt-3 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      {loaded && revisions.length === 0 && <p className="mt-4 text-sm text-muted">No revisions issued yet.</p>}
      {revisions.length > 0 && (
        <ul className="mt-4 divide-y divide-line">
          {revisions.map((r) => (
            <li key={r._id} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="flex h-8 w-10 items-center justify-center rounded-md bg-accent-soft text-sm font-bold text-accent-strong">{r.label}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.note || "No note"}</div>
                <div className="text-xs text-muted">
                  {timeAgo(r.createdAt)} · {fmt(r.summary.arrayKWp ?? 0, 2)} kWp · {fmt(r.summary.batteryKWh ?? 0, 1)} kWh · {moneyCompact(r.summary.capex ?? 0, project.boq.currency)}
                </div>
              </div>
              {collab.canManage && (
                <button className="btn btn-sm" onClick={() => restore(r)} disabled={busy}>
                  Restore
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

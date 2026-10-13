"use client";

import { useCallback, useEffect, useState } from "react";
import { ChangeRequestList, type ChangeView } from "./ChangeRequestList";
import { cx } from "./ui";

const TABS = [
  { key: "inbox", label: "Waiting for me", empty: "Nothing is waiting for your approval." },
  { key: "mine", label: "My proposals", empty: "You have not proposed any changes." },
  { key: "history", label: "History", empty: "No decided changes yet." },
] as const;

/** Every change request across shared projects and shared equipment. */
export function ApprovalsInbox() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("inbox");
  const [changes, setChanges] = useState<ChangeView[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/changes?scope=${tab}`);
    setChanges(res.ok ? (await res.json()).changes : []);
    setLoading(false);
  }, [tab]);
  useEffect(() => {
    void load();
  }, [load]);
  const current = TABS.find((t) => t.key === tab)!;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">Approvals</h1>
      <p className="text-sm text-muted">Proposed edits to information you created in shared projects and shared equipment, and the status of the changes you proposed.</p>
      <div className="mt-6 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cx("-mb-px border-b-2 px-4 py-2 text-sm font-medium", tab === t.key ? "border-accent text-accent-strong" : "border-transparent text-muted hover:text-text")}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="card mt-4 px-5">{loading ? <p className="py-4 text-sm text-muted">Loading…</p> : <ChangeRequestList changes={changes} empty={current.empty} onChanged={load} showTarget />}</div>
    </main>
  );
}

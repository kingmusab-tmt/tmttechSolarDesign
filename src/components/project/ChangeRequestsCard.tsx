"use client";

import { useCallback, useEffect, useState } from "react";
import { ChangeRequestList, type ChangeView } from "../ChangeRequestList";
import { Card, cx } from "../ui";
import { useProject } from "./ProjectProvider";

/** Proposed edits to this project: review the ones waiting for you, follow your own, see history. */
export function ChangeRequestsCard() {
  const { project, collab, refresh, pendingCounts } = useProject();
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [changes, setChanges] = useState<ChangeView[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${project._id}/changes${tab === "pending" ? "?status=pending" : ""}`);
    if (res.ok) setChanges((await res.json()).changes);
    setLoaded(true);
  }, [project._id, tab]);

  useEffect(() => {
    void load();
  }, [load, pendingCounts.forMe, pendingCounts.mine]);

  if (!collab.shared && loaded && changes.length === 0 && tab === "pending") return null;

  return (
    <div id="changes" className="scroll-mt-24">
      <Card
        title="Change requests"
        subtitle="Edits to information another member created need a comment and the creator's approval before they are applied"
        actions={
          <div className="flex rounded-lg border border-line p-0.5 text-xs">
            {(["pending", "all"] as const).map((t) => (
              <button key={t} className={cx("rounded-md px-2.5 py-1", tab === t ? "bg-accent-soft font-semibold text-accent-strong" : "text-muted")} onClick={() => setTab(t)}>
                {t === "pending" ? "Pending" : "All"}
              </button>
            ))}
          </div>
        }
      >
        <ChangeRequestList
          changes={changes}
          empty={tab === "pending" ? "No pending changes." : "No change requests yet."}
          onChanged={async () => {
            await load();
            await refresh();
          }}
        />
      </Card>
    </div>
  );
}

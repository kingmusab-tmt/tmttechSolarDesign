"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDiffValue } from "@/lib/collab";
import { timeAgo } from "@/lib/format";
import { Badge, cx } from "./ui";

export interface ChangeView {
  _id: string;
  kind: "section" | "equipment";
  projectId: string | null;
  projectName: string;
  section: string | null;
  sectionLabel: string;
  equipmentId: string | null;
  equipmentName: string;
  proposedBy: { id: string; name: string };
  comment: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  createdAt: string;
  reviewedBy: { id: string; name: string } | null;
  reviewComment: string;
  diff: { path: string; before: unknown; after: unknown; kind: "changed" | "added" | "removed" }[];
  stale: boolean;
  canReview: boolean;
  canWithdraw: boolean;
}

const STATUS_TONE = { pending: "accent", approved: "good", rejected: "bad", withdrawn: "neutral" } as const;

function ChangeCard({ c, onDone, showTarget }: { c: ChangeView; onDone: () => void; showTarget: boolean }) {
  const [review, setReview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function act(action: "approve" | "reject" | "withdraw", force = false) {
    if (action === "reject" && review.trim().length < 3) return setError("Add a comment explaining why you are rejecting this change");
    setBusy(true);
    setError("");
    const res = await fetch(`/api/changes/${c._id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, comment: review.trim(), force }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.status === 409 && data.code === "stale") {
      if (confirm(`${data.error}\n\nApprove anyway?`)) return act("approve", true);
      return;
    }
    if (!res.ok) return setError(data.error ?? "Action failed");
    onDone();
  }

  return (
    <li className="space-y-3 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">
            {c.kind === "section" ? c.sectionLabel : c.equipmentName}
            {showTarget && c.kind === "section" && c.projectId && (
              <Link className="ml-2 text-xs font-normal text-accent-strong underline" href={`/projects/${c.projectId}`}>
                {c.projectName}
              </Link>
            )}
            {showTarget && c.kind === "equipment" && <span className="ml-2 text-xs font-normal text-muted">Shared equipment</span>}
          </div>
          <div className="text-xs text-muted">
            Proposed by {c.proposedBy.name} · {timeAgo(c.createdAt)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {c.stale && c.status === "pending" && <Badge tone="warn">Changed since proposed</Badge>}
          <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
        </div>
      </div>

      <blockquote className="rounded-lg border-l-4 border-accent bg-surface-2 px-3 py-2 text-sm">“{c.comment}”</blockquote>

      {c.diff.length > 0 && (
        <div className="overflow-x-auto">
          <table className="table text-xs">
            <thead>
              <tr>
                <th>Field</th>
                <th>Current</th>
                <th>Proposed</th>
              </tr>
            </thead>
            <tbody>
              {c.diff.map((d, i) => (
                <tr key={i}>
                  <td className="font-mono">{d.path}</td>
                  <td className={cx("num", d.kind !== "added" && "text-bad line-through decoration-1")}>{formatDiffValue(d.before)}</td>
                  <td className={cx("num font-medium", d.kind !== "removed" && "text-good")}>{formatDiffValue(d.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {c.reviewedBy && (
        <p className="text-xs text-muted">
          {c.status === "approved" ? "Approved" : "Rejected"} by {c.reviewedBy.name}
          {c.reviewComment ? `: “${c.reviewComment}”` : ""}
        </p>
      )}

      {c.canReview && (
        <div className="space-y-2">
          <textarea className="input min-h-14 text-sm" placeholder="Reviewer comment (required to reject)" value={review} onChange={(e) => setReview(e.target.value)} maxLength={2000} />
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act("approve")}>
              ✓ Approve &amp; apply
            </button>
            <button className="btn btn-sm text-bad" disabled={busy} onClick={() => act("reject")}>
              ✕ Reject
            </button>
          </div>
        </div>
      )}
      {c.canWithdraw && (
        <button className="btn btn-sm" disabled={busy} onClick={() => act("withdraw")}>
          Withdraw proposal
        </button>
      )}
      {error && <p className="text-sm text-bad">{error}</p>}
    </li>
  );
}

export function ChangeRequestList({ changes, onChanged, empty, showTarget = false }: { changes: ChangeView[]; onChanged: () => void; empty: string; showTarget?: boolean }) {
  if (!changes.length) return <p className="py-4 text-sm text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {changes.map((c) => (
        <ChangeCard key={c._id} c={c} onDone={onChanged} showTarget={showTarget} />
      ))}
    </ul>
  );
}

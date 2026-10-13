"use client";

import { useEffect, useState } from "react";
import { SECTION_LABELS, STEP_SECTIONS } from "@/lib/collab";
import { timeAgo } from "@/lib/format";
import type { SectionKey, StepKey } from "@/lib/schemas";
import { STEPS } from "@/lib/steps";
import { Badge, cx } from "../ui";
import { useProject } from "./ProjectProvider";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Teammates currently in the project, and the step each one is on. */
export function PresenceAvatars() {
  const { presence, collab } = useProject();
  if (!collab.shared) return null;
  return (
    <div className="flex items-center -space-x-1.5" aria-label="Teammates online">
      {presence.slice(0, 5).map((p) => (
        <span key={p.userId} title={`${p.userName}${p.step ? ` · on ${STEPS.find((s) => s.key === p.step)?.title ?? p.step}` : ""}`} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-info text-[10px] font-bold text-white">
          {initials(p.userName)}
        </span>
      ))}
      {presence.length > 5 && <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-surface-2 text-[10px] font-semibold">+{presence.length - 5}</span>}
    </div>
  );
}

/** Dismissible message for conflicts, locks and refused saves. */
export function NoticeBanner() {
  const { notice, clearNotice } = useProject();
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(clearNotice, 12_000);
    return () => clearTimeout(t);
  }, [notice, clearNotice]);
  if (!notice) return null;
  return (
    <div className="no-print flex items-start justify-between gap-3 rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn" role="status">
      <span>{notice}</span>
      <button className="shrink-0 font-semibold" onClick={clearNotice} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}

/** Who created each section this step edits, and whether my edits need their approval. */
export function SectionOwnership({ step }: { step: StepKey }) {
  const { collab, needsApproval } = useProject();
  if (!collab.shared) return null;
  const sections = STEP_SECTIONS[step];
  if (!sections.length) return null;
  const approval = sections.filter((s) => needsApproval(s));
  return (
    <div className="no-print space-y-2">
      <div className="flex flex-wrap gap-2 text-xs">
        {sections.map((s) => {
          const owner = collab.sectionOwners[s];
          const edited = collab.sectionEditedBy[s];
          return (
            <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1">
              <span className="font-medium">{SECTION_LABELS[s]}</span>
              <span className="text-muted">
                · {owner ? (owner.id === collab.me.id ? "created by you" : `created by ${owner.name}`) : "not started: anyone can add it"}
                {edited ? ` · last edit ${edited.name} ${timeAgo(edited.at)}` : ""}
              </span>
            </span>
          );
        })}
      </div>
      {approval.length > 0 && (
        <p className="rounded-lg bg-info-soft px-3 py-2 text-xs text-info">
          {approval.map((s) => SECTION_LABELS[s]).join(" and ")} {approval.length > 1 ? "were" : "was"} entered by {[...new Set(approval.map((s) => collab.sectionOwners[s]?.name))].join(" and ")}. You can make changes,
          but they are only saved once you submit them with a comment and the creator approves.
        </p>
      )}
    </div>
  );
}

export function LockBanner({ step }: { step: StepKey }) {
  const { lockedBy } = useProject();
  const lock = lockedBy(step);
  if (!lock) return null;
  return (
    <div className="no-print flex items-center gap-3 rounded-xl border border-info/40 bg-info-soft px-4 py-3 text-sm text-info" role="status">
      <span className="text-lg">🔒</span>
      <span>
        <strong>{lock.userName}</strong> is editing this step right now, so it is read-only for you. It unlocks automatically when they finish or go idle; their changes appear here within a few seconds.
      </span>
    </div>
  );
}

/** Sticky bar to submit (with a required comment) or discard edits that need the creator's approval. */
export function ProposalBar({ step }: { step: StepKey }) {
  const { proposals, submitProposal, discardProposal, collab } = useProject();
  const mine = proposals.filter((s) => STEP_SECTIONS[step].includes(s));
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  if (!mine.length && !done) return null;

  async function submit() {
    if (comment.trim().length < 3) return setError("Add a comment explaining your change (at least 3 characters)");
    setBusy(true);
    setError("");
    for (const s of mine) {
      const r = await submitProposal(s, comment.trim());
      if (!r.ok) {
        setError(r.error ?? "Could not submit");
        setBusy(false);
        return;
      }
    }
    setDone(`Submitted for approval by ${[...new Set(mine.map((s) => collab.sectionOwners[s]?.name ?? "the creator"))].join(", ")}. You will see the result under Change requests.`);
    setComment("");
    setBusy(false);
  }

  if (done && !mine.length)
    return (
      <div className="no-print sticky bottom-4 z-20 flex items-center justify-between gap-3 rounded-xl border border-good/40 bg-good-soft px-4 py-3 text-sm text-good shadow-lg">
        <span>✓ {done}</span>
        <button className="font-semibold" onClick={() => setDone("")}>
          ✕
        </button>
      </div>
    );

  return (
    <div className="no-print sticky bottom-4 z-20 space-y-3 rounded-xl border border-accent/50 bg-surface p-4 shadow-lg">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone="accent">Unsaved proposal</Badge>
        <span>
          Your changes to <strong>{mine.map((s: SectionKey) => SECTION_LABELS[s]).join(", ")}</strong> need approval from {[...new Set(mine.map((s) => collab.sectionOwners[s]?.name ?? "the creator"))].join(", ")}.
        </span>
      </div>
      <textarea className="input min-h-16" placeholder="Explain what you changed and why (required)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
      {error && <p className="text-sm text-bad">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={submit} disabled={busy}>
          {busy ? "Submitting…" : "Submit for approval"}
        </button>
        <button className="btn" onClick={() => mine.forEach(discardProposal)} disabled={busy}>
          Discard changes
        </button>
      </div>
    </div>
  );
}

export function StepReadOnly({ readOnly, children }: { readOnly: boolean; children: React.ReactNode }) {
  return (
    <fieldset disabled={readOnly} className={cx("m-0 min-w-0 border-0 p-0", readOnly && "opacity-75")}>
      {children}
    </fieldset>
  );
}

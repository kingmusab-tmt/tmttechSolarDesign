"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/schemas";
import { STEPS, type StepStatus } from "@/lib/steps";
import { ProgressBar, cx } from "../ui";
import { PresenceAvatars } from "./CollabBits";
import { useProject, type SaveState } from "./ProjectProvider";
import { ShareDialog } from "./ShareDialog";

const STATUS_LABEL: Record<ProjectStatus, string> = { draft: "Draft", designing: "Designing", review: "In review", approved: "Approved", installed: "Installed", commissioned: "Commissioned" };

const SAVE_LABEL: Record<SaveState, { text: string; cls: string }> = {
  saved: { text: "All changes saved", cls: "text-muted" },
  dirty: { text: "Unsaved changes…", cls: "text-muted" },
  saving: { text: "Saving…", cls: "text-muted" },
  offline: { text: "Offline: changes will sync when you reconnect", cls: "text-warn" },
  error: { text: "Save failed", cls: "text-bad" },
};

function StepDot({ status, index, active }: { status: StepStatus; index: number; active: boolean }) {
  return (
    <span
      className={cx(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
        status === "complete" && "border-good bg-good text-white",
        status === "in_progress" && "border-accent bg-accent-soft text-accent-strong",
        status === "not_started" && "border-line bg-surface text-muted",
        active && status !== "complete" && "ring-2 ring-accent/40",
      )}
    >
      {status === "complete" ? "✓" : index + 1}
    </span>
  );
}

export function ProjectChrome({ children }: { children: ReactNode }) {
  const { project, steps, progress, saveState, saveError, setMeta, flush, collab, pendingCounts, locks } = useProject();
  const [sharing, setSharing] = useState(false);
  const pathname = usePathname();
  const base = `/projects/${project._id}`;
  const [navOpen, setNavOpen] = useState(false);
  const save = SAVE_LABEL[saveState];

  const nav = (
    <nav className="space-y-4">
      <Link href={base} onClick={() => setNavOpen(false)} className={cx("flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium", pathname === base ? "bg-accent-soft text-accent-strong" : "hover:bg-surface-2")}>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-xs">◎</span>
        Overview
      </Link>
      {(["Sizing", "Engineering", "Deliverables"] as const).map((phase) => (
        <div key={phase}>
          <div className="mb-1 px-2 text-[10px] font-semibold tracking-wider text-muted uppercase">{phase}</div>
          <ul className="space-y-0.5">
            {STEPS.filter((s) => s.phase === phase).map((s) => {
              const href = `${base}/${s.key}`;
              const active = pathname === href;
              const st = steps[s.key];
              const editor = locks.find((l) => l.step === s.key && l.userId !== collab.me.id);
              return (
                <li key={s.key}>
                  <Link href={href} onClick={() => setNavOpen(false)} className={cx("flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm", active ? "bg-accent-soft font-medium text-accent-strong" : "hover:bg-surface-2")}>
                    <StepDot status={st.status} index={STEPS.indexOf(s)} active={active} />
                    <span className="min-w-0 flex-1 truncate">{s.title}</span>
                    {editor && (
                      <span title={`${editor.userName} is editing`} aria-label={`${editor.userName} is editing`}>
                        🔒
                      </span>
                    )}
                    {st.fails > 0 ? (
                      <span className="rounded-full bg-bad-soft px-1.5 text-[10px] font-semibold text-bad" title={`${st.fails} failing check(s)`}>
                        {st.fails}
                      </span>
                    ) : st.warns > 0 ? (
                      <span className="rounded-full bg-warn-soft px-1.5 text-[10px] font-semibold text-warn" title={`${st.warns} warning(s)`}>
                        {st.warns}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
      <div className="no-print flex flex-wrap items-center gap-3 border-b border-line py-4">
        <button data-tour="steps-mobile" className="btn btn-sm lg:hidden" onClick={() => setNavOpen((v) => !v)} aria-expanded={navOpen}>
          ☰ Steps
        </button>
        <div className="min-w-0 flex-1">
          <input
            className="w-full truncate rounded-md bg-transparent px-1 text-xl font-bold outline-none hover:bg-surface-2 focus:bg-surface focus:ring-2 focus:ring-accent/30 read-only:hover:bg-transparent"
            readOnly={!collab.canManage}
            title={collab.canManage ? undefined : "Only the project owner or an organisation admin can rename the project"}
            value={project.name}
            onChange={(e) => setMeta({ name: e.target.value || "Untitled project" })}
            aria-label="Project name"
          />
          <div data-tour="save-status" className={cx("w-fit px-1 text-xs", save.cls)} title={saveError}>
            {save.text}
            {(saveState === "error" || saveState === "offline") && (
              <button className="ml-2 underline" onClick={() => void flush()}>
                Retry
              </button>
            )}
            {saveState === "error" && saveError && <span className="ml-2">({saveError})</span>}
            {collab.shared && (
              <span className="ml-2 text-muted">
                · Shared with <strong className="text-text">{collab.orgName}</strong>
                {!collab.isOwner && <> · owner {collab.ownerName}</>}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PresenceAvatars />
          {pendingCounts.forMe > 0 && (
            <Link href={`${base}#changes`} className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-white" title="Changes waiting for your approval">
              {pendingCounts.forMe} to review
            </Link>
          )}
          {collab.isOwner && (
            <button data-tour="share" className="btn btn-sm" onClick={() => setSharing(true)}>
              {collab.shared ? "Sharing" : "Share"}
            </button>
          )}
          <div data-tour="progress" className="w-40">
            <div className="mb-1 flex justify-between text-[11px] text-muted">
              <span>
                {progress.completed}/{progress.total} complete
              </span>
              <span className="num font-semibold text-text">{progress.pct} %</span>
            </div>
            <ProgressBar pct={progress.pct} />
          </div>
          <select data-tour="status" className="input w-auto py-1.5" value={project.status} disabled={!collab.canManage} onChange={(e) => setMeta({ status: e.target.value as ProjectStatus })} aria-label="Project status">
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-6 py-6">
        <aside className={cx("no-print w-60 shrink-0", navOpen ? "fixed inset-0 z-40 block overflow-y-auto bg-surface p-4" : "hidden lg:block")}>
          {navOpen && (
            <button className="btn btn-sm mb-3" onClick={() => setNavOpen(false)}>
              Close
            </button>
          )}
          <div data-tour="steps" className="lg:sticky lg:top-20">
            {nav}
          </div>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
        {sharing && <ShareDialog onClose={() => setSharing(false)} />}
      </div>
    </div>
  );
}

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { computeDesign, type DesignResults } from "@/lib/calc";
import { sameValue, sectionWriteMode, SECTION_LABELS, STEP_SECTIONS, type CollabInfo, type LockInfo, type PresenceInfo } from "@/lib/collab";
import type { DesignInputs, ProjectData, ProjectStatus, SectionKey, StepKey } from "@/lib/schemas";
import { overallProgress, stepStatuses, type StepState } from "@/lib/steps";

export type SaveState = "saved" | "saving" | "dirty" | "offline" | "error";

interface Ctx {
  project: ProjectData;
  results: DesignResults;
  steps: Record<StepKey, StepState>;
  progress: ReturnType<typeof overallProgress>;
  saveState: SaveState;
  saveError: string;
  update: <K extends SectionKey>(key: K, value: DesignInputs[K] | ((prev: DesignInputs[K]) => DesignInputs[K])) => void;
  setMeta: (meta: { name?: string; status?: ProjectStatus }) => void;
  toggleComplete: (step: StepKey, value?: boolean) => void;
  flush: () => Promise<void>;

  // ---- collaboration (shared projects) ----
  collab: CollabInfo;
  locks: LockInfo[];
  presence: PresenceInfo[];
  pendingCounts: { forMe: number; mine: number };
  /** Sections with local edits that need the creator's approval before they are saved. */
  proposals: SectionKey[];
  needsApproval: (key: SectionKey) => boolean;
  /** Lock held by someone else on any section the step edits. */
  lockedBy: (step: StepKey) => LockInfo | null;
  acquireStep: (step: StepKey) => Promise<boolean>;
  releaseLock: () => Promise<void>;
  setActiveStep: (step: StepKey | "") => void;
  submitProposal: (section: SectionKey, comment: string) => Promise<{ ok: boolean; error?: string }>;
  discardProposal: (section: SectionKey) => void;
  refresh: (sections?: SectionKey[]) => Promise<void>;
  notice: string;
  clearNotice: () => void;
}

const ProjectContext = createContext<Ctx | null>(null);

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used inside <ProjectProvider>");
  return ctx;
}

const DEBOUNCE_MS = 800;
const SYNC_MS = 6_000;
const LOCK_RENEW_MS = 20_000;
const LOCK_IDLE_MS = 90_000;

type Pending = { sections: Partial<Record<SectionKey, unknown>>; name?: string; status?: ProjectStatus };
const storageKey = (id: string) => `shs-pending:${id}`;
const isEmpty = (p: Pending) => !Object.keys(p.sections).length && p.name === undefined && p.status === undefined;

/** Unsaved edits are mirrored to localStorage so they survive a closed tab or an offline restart. */
function persistPending(id: string, p: Pending) {
  try {
    if (isEmpty(p)) localStorage.removeItem(storageKey(id));
    else localStorage.setItem(storageKey(id), JSON.stringify({ ...p, savedAt: Date.now() }));
  } catch {
    // Storage unavailable (private mode, quota): autosave still works while the tab is open.
  }
}

function readPending(id: string): Pending | null {
  try {
    const raw = localStorage.getItem(storageKey(id));
    if (!raw) return null;
    const p = JSON.parse(raw) as Pending;
    return p && typeof p.sections === "object" && !isEmpty(p) ? p : null;
  } catch {
    return null;
  }
}

export function ProjectProvider({ initial, collab: initialCollab, children }: { initial: ProjectData; collab: CollabInfo; children: ReactNode }) {
  const [project, setProject] = useState<ProjectData>(initial);
  const [collab, setCollab] = useState<CollabInfo>(initialCollab);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState("");
  const [locks, setLocks] = useState<LockInfo[]>([]);
  const [presence, setPresence] = useState<PresenceInfo[]>([]);
  const [pendingCounts, setPendingCounts] = useState({ forMe: 0, mine: 0 });
  const [proposals, setProposals] = useState<SectionKey[]>([]);
  const [notice, setNotice] = useState("");

  const pending = useRef<Pending>({ sections: {} });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(project);
  latest.current = project;
  const collabRef = useRef(collab);
  collabRef.current = collab;
  const locksRef = useRef(locks);
  locksRef.current = locks;
  /** Server values of sections being edited as proposals, so they can be restored. */
  const approved = useRef<Partial<Record<SectionKey, unknown>>>({});
  const proposalsRef = useRef(proposals);
  proposalsRef.current = proposals;
  const myLock = useRef<{ step: StepKey; sections: SectionKey[] } | null>(null);
  const lastEditAt = useRef(0);
  const activeStep = useRef<StepKey | "">("");
  const acquiring = useRef<{ step: StepKey; promise: Promise<boolean> } | null>(null);

  const needsApproval = useCallback(
    (key: SectionKey) => sectionWriteMode({ shared: collabRef.current.shared, section: key, ownerOfSection: collabRef.current.sectionOwners[key]?.id, userId: collabRef.current.me.id }) === "approval",
    [],
  );
  const lockOn = useCallback((key: SectionKey) => locksRef.current.find((l) => l.section === key && l.userId !== collabRef.current.me.id) ?? null, []);

  /** Pull the latest server copy (all sections, or just some) and collaboration context. */
  const refresh = useCallback(async (sections?: SectionKey[]) => {
    const res = await fetch(`/api/projects/${latest.current._id}`);
    if (!res.ok) return;
    const data = (await res.json()) as { project: ProjectData; collab: CollabInfo };
    setCollab(data.collab);
    setProject((prev) => {
      const next = { ...prev } as Record<string, unknown>;
      const keys = sections ?? (Object.keys(data.project) as SectionKey[]);
      for (const k of keys) {
        // Never clobber what the user is editing right now.
        if (k in pending.current.sections || proposalsRef.current.includes(k as SectionKey)) continue;
        next[k] = (data.project as unknown as Record<string, unknown>)[k];
      }
      if (!sections) {
        if (pending.current.name === undefined) next.name = data.project.name;
        if (pending.current.status === undefined) next.status = data.project.status;
      }
      return next as unknown as ProjectData;
    });
  }, []);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const body = pending.current;
    if (isEmpty(body)) return;
    pending.current = { sections: {} };
    setSaveState("saving");
    const baseRevs = Object.fromEntries(Object.keys(body.sections).map((k) => [k, collabRef.current.sectionRev[k] ?? 0]));
    try {
      const res = await fetch(`/api/projects/${latest.current._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, baseRevs }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.code === "conflict") {
        // Someone saved first: take their version of the conflicting sections, keep everything else queued.
        const conflicted = (data.sections ?? []) as SectionKey[];
        for (const [k, v] of Object.entries(body.sections)) if (!conflicted.includes(k as SectionKey)) pending.current.sections[k as SectionKey] = v;
        setProject((prev) => ({ ...prev, ...(data.current as Partial<ProjectData>) }));
        setCollab((c) => ({ ...c, sectionRev: data.sectionRev ?? c.sectionRev, sectionEditedBy: data.sectionEditedBy ?? c.sectionEditedBy }));
        setNotice(`${conflicted.map((s) => SECTION_LABELS[s]).join(", ")} was just changed by a teammate and has been refreshed. Please reapply your last change.`);
        persistPending(latest.current._id, pending.current);
        setSaveState(isEmpty(pending.current) ? "saved" : "dirty");
        if (!isEmpty(pending.current)) timer.current = setTimeout(() => void flush(), DEBOUNCE_MS);
        return;
      }
      if ((res.status === 403 && data.code === "approval_required") || (res.status === 423 && data.code === "locked")) {
        const section = data.section as SectionKey;
        for (const [k, v] of Object.entries(body.sections)) if (k !== section) pending.current.sections[k as SectionKey] = v;
        if (data.code === "approval_required") {
          // Ownership changed under us: keep the edit as a proposal instead of losing it.
          const mine = body.sections[section];
          await refresh();
          const res2 = await fetch(`/api/projects/${latest.current._id}`);
          const fresh = res2.ok ? ((await res2.json()) as { project: ProjectData }).project : null;
          if (fresh) approved.current[section] = (fresh as unknown as Record<string, unknown>)[section];
          setProject((prev) => ({ ...prev, [section]: mine }));
          setProposals((p) => (p.includes(section) ? p : [...p, section]));
        } else {
          await refresh([section]);
        }
        setNotice(data.error ?? "That section could not be saved");
        persistPending(latest.current._id, pending.current);
        setSaveState(isEmpty(pending.current) ? "saved" : "dirty");
        return;
      }
      if (!res.ok) throw Object.assign(new Error(data.error || `Save failed (${res.status})`), { status: res.status });
      if (data.sectionRev) setCollab((c) => ({ ...c, sectionRev: { ...c.sectionRev, ...data.sectionRev } }));
      if (data.sectionOwners && collabRef.current.shared) {
        setCollab((c) => ({
          ...c,
          sectionOwners: Object.fromEntries(
            Object.entries(data.sectionOwners as Record<string, string>).map(([s, id]) => [s, c.sectionOwners[s]?.id === id ? c.sectionOwners[s] : { id, name: id === c.me.id ? c.me.name : "Team member" }]),
          ),
        }));
      }
      setSaveError("");
      persistPending(latest.current._id, pending.current);
      setSaveState(isEmpty(pending.current) ? "saved" : "dirty");
    } catch (e) {
      const status = (e as { status?: number }).status;
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      // A 4xx (other than auth/timeouts) means the data itself was rejected: retrying can never succeed.
      const rejected = status !== undefined && status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429;
      if (!rejected) {
        pending.current = {
          sections: { ...body.sections, ...pending.current.sections },
          name: pending.current.name ?? body.name,
          status: pending.current.status ?? body.status,
        };
      }
      persistPending(latest.current._id, pending.current);
      setSaveState(offline || status === undefined ? "offline" : "error");
      setSaveError(status === 401 ? "Session expired: sign in again in another tab, then retry" : e instanceof Error ? e.message : "Save failed");
    }
  }, [refresh]);

  const schedule = useCallback(() => {
    persistPending(latest.current._id, pending.current);
    setSaveState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), DEBOUNCE_MS);
  }, [flush]);

  const update = useCallback<Ctx["update"]>(
    (key, value) => {
      const lock = lockOn(key);
      if (lock) {
        setNotice(`${lock.userName} is editing ${SECTION_LABELS[key]} right now. Wait until they finish.`);
        return;
      }
      lastEditAt.current = Date.now();
      const proposal = needsApproval(key);
      setProject((prev) => {
        const next = typeof value === "function" ? (value as (p: unknown) => unknown)(prev[key]) : value;
        if (proposal) {
          if (!(key in approved.current)) approved.current[key] = prev[key];
        } else {
          pending.current.sections[key] = next;
          persistPending(prev._id, pending.current);
        }
        return { ...prev, [key]: next };
      });
      if (proposal) setProposals((p) => (p.includes(key) ? p : [...p, key]));
      else schedule();
    },
    [lockOn, needsApproval, schedule],
  );

  const setMeta = useCallback<Ctx["setMeta"]>(
    (meta) => {
      if (!collabRef.current.canManage) return;
      setProject((prev) => ({ ...prev, ...meta }));
      if (meta.name !== undefined) pending.current.name = meta.name;
      if (meta.status !== undefined) pending.current.status = meta.status;
      schedule();
    },
    [schedule],
  );

  const toggleComplete = useCallback<Ctx["toggleComplete"]>((step, value) => update("progress", (prev) => ({ ...prev, [step]: value ?? !prev[step] })), [update]);

  /* ---------------- proposals ---------------- */

  const discardProposal = useCallback((section: SectionKey) => {
    const original = approved.current[section];
    delete approved.current[section];
    setProject((prev) => ({ ...prev, [section]: original }));
    setProposals((p) => p.filter((s) => s !== section));
  }, []);

  const submitProposal = useCallback<Ctx["submitProposal"]>(async (section, comment) => {
    const value = (latest.current as unknown as Record<string, unknown>)[section];
    if (sameValue(value, approved.current[section])) {
      discardProposal(section);
      return { ok: false, error: "Nothing changed" };
    }
    const res = await fetch(`/api/projects/${latest.current._id}/changes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, value, comment, baseRev: collabRef.current.sectionRev[section] ?? 0 }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? "Could not submit the proposal" };
    discardProposal(section); // show the approved values again until the creator decides
    setPendingCounts((c) => ({ ...c, mine: c.mine + 1 }));
    return { ok: true };
  }, [discardProposal]);

  /* ---------------- locks ---------------- */

  const lockRequest = useCallback(async (action: "acquire" | "renew" | "release", sections: SectionKey[], step: string) => {
    const res = await fetch(`/api/projects/${latest.current._id}/locks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, sections, step }), keepalive: action === "release" });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  }, []);

  const releaseLock = useCallback(async () => {
    const held = myLock.current;
    myLock.current = null;
    if (held) await lockRequest("release", held.sections, held.step).catch(() => undefined);
  }, [lockRequest]);

  const acquireStep = useCallback<Ctx["acquireStep"]>(async (step) => {
    if (!collabRef.current.shared) return true;
    const sections = STEP_SECTIONS[step];
    if (!sections.length) return true;
    if (myLock.current?.step === step) return true;
    // Many focus/click events arrive together: share one in-flight request per step.
    if (acquiring.current?.step === step) return acquiring.current.promise;
    const promise = acquireNow(step, sections);
    acquiring.current = { step, promise };
    try {
      return await promise;
    } finally {
      acquiring.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acquireNow = async (step: StepKey, sections: SectionKey[]) => {
    if (myLock.current) await releaseLock();
    lastEditAt.current = Date.now();
    const { ok, data } = await lockRequest("acquire", sections, step).catch(() => ({ ok: false, data: {} as Record<string, string> }));
    if (!ok) {
      if (data.code === "locked") {
        setNotice(`${data.lockedBy} is editing this step right now. It is read-only for you until they finish.`);
        setLocks((l) => [...l.filter((x) => x.section !== data.section), { section: data.section, userId: "other", userName: data.lockedBy, step }]);
      }
      return false;
    }
    myLock.current = { step, sections };
    return true;
  };

  // Renew the lock while actively editing; let it go after a period of inactivity.
  useEffect(() => {
    const t = setInterval(() => {
      const held = myLock.current;
      if (!held) return;
      if (Date.now() - lastEditAt.current > LOCK_IDLE_MS) void releaseLock();
      else void lockRequest("renew", held.sections, held.step).catch(() => undefined);
    }, LOCK_RENEW_MS);
    return () => clearInterval(t);
  }, [lockRequest, releaseLock]);

  const setActiveStep = useCallback(
    (step: StepKey | "") => {
      activeStep.current = step;
      if (myLock.current && myLock.current.step !== step) void releaseLock();
    },
    [releaseLock],
  );

  /* ---------------- live sync ---------------- */

  const sync = useCallback(async () => {
    if (!collabRef.current.shared && !collabRef.current.orgId) return;
    const res = await fetch(`/api/projects/${latest.current._id}/sync?step=${activeStep.current}`).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    setLocks(data.locks ?? []);
    setPresence(data.presence ?? []);
    setPendingCounts(data.pending ?? { forMe: 0, mine: 0 });
    const known = collabRef.current.sectionRev;
    const changed = Object.entries((data.sectionRev ?? {}) as Record<string, number>)
      .filter(([k, rev]) => rev > (known[k] ?? 0) && !(k in pending.current.sections) && !proposalsRef.current.includes(k as SectionKey))
      .map(([k]) => k as SectionKey);
    setCollab((c) => ({ ...c, sectionOwners: data.sectionOwners ?? c.sectionOwners, sectionEditedBy: data.sectionEditedBy ?? c.sectionEditedBy }));
    if (changed.length) {
      await refresh(changed);
      setCollab((c) => ({ ...c, sectionRev: { ...c.sectionRev, ...Object.fromEntries(changed.map((k) => [k, data.sectionRev[k]])) } }));
    }
    if (pending.current.name === undefined && data.name !== latest.current.name) setProject((p) => ({ ...p, name: data.name }));
    if (pending.current.status === undefined && data.status !== latest.current.status) setProject((p) => ({ ...p, status: data.status }));
  }, [refresh]);

  useEffect(() => {
    if (!collab.shared) return;
    void sync();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void sync();
    }, SYNC_MS);
    return () => clearInterval(t);
  }, [collab.shared, sync]);

  // Restore edits left unsaved by a previous session (closed tab, offline restart) and sync them.
  useEffect(() => {
    const saved = readPending(initial._id);
    if (!saved) return;
    pending.current = { sections: { ...saved.sections, ...pending.current.sections }, name: saved.name, status: saved.status };
    setProject((prev) => ({ ...prev, ...(saved.sections as Partial<ProjectData>), ...(saved.name !== undefined && { name: saved.name }), ...(saved.status !== undefined && { status: saved.status }) }));
    setSaveState("dirty");
    void flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Retry when the connection returns; save (and free locks) before the tab closes.
  useEffect(() => {
    const onOnline = () => void flush();
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      void releaseLock();
      if (!isEmpty(pending.current) || proposalsRef.current.length) {
        void flush();
        e.preventDefault();
      }
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
      void releaseLock();
    };
  }, [flush, releaseLock]);

  const lockedBy = useCallback((step: StepKey) => STEP_SECTIONS[step].map((s) => locks.find((l) => l.section === s && l.userId !== collab.me.id)).find(Boolean) ?? null, [locks, collab.me.id]);

  const results = useMemo(() => computeDesign(project), [project]);
  const steps = useMemo(() => stepStatuses(project, results), [project, results]);
  const progress = useMemo(() => overallProgress(steps), [steps]);
  const clearNotice = useCallback(() => setNotice(""), []);

  const value = useMemo<Ctx>(
    () => ({
      project,
      results,
      steps,
      progress,
      saveState,
      saveError,
      update,
      setMeta,
      toggleComplete,
      flush,
      collab,
      locks,
      presence,
      pendingCounts,
      proposals,
      needsApproval,
      lockedBy,
      acquireStep,
      releaseLock,
      setActiveStep,
      submitProposal,
      discardProposal,
      refresh,
      notice,
      clearNotice,
    }),
    [project, results, steps, progress, saveState, saveError, update, setMeta, toggleComplete, flush, collab, locks, presence, pendingCounts, proposals, needsApproval, lockedBy, acquireStep, releaseLock, setActiveStep, submitProposal, discardProposal, refresh, notice, clearNotice],
  );
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useProject } from "./ProjectProvider";

interface OrgOption {
  _id: string;
  name: string;
  members: unknown[];
}

/** Project owner: share the design with an organisation (or make it personal again). */
export function ShareDialog({ onClose }: { onClose: () => void }) {
  const { project, collab, refresh } = useProject();
  const [orgs, setOrgs] = useState<OrgOption[] | null>(null);
  const [orgId, setOrgId] = useState(collab.orgId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/orgs")
      .then((r) => r.json())
      .then((d) => setOrgs(d.orgs ?? []))
      .catch(() => setOrgs([]));
  }, []);

  async function save(target: string | null) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/projects/${project._id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgId: target }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Could not update sharing");
    await refresh();
    // A full reload starts (or stops) live collaboration cleanly.
    window.location.reload();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Share project" onClick={onClose}>
      <div className="card w-full max-w-md space-y-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 className="text-lg font-semibold">Share with your organisation</h2>
          <p className="text-sm text-muted">Members can open the design and work on it with you. Information you have entered stays yours: their edits to it need your approval.</p>
        </div>
        {orgs === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : orgs.length === 0 ? (
          <p className="text-sm">
            You are not in an organisation yet.{" "}
            <Link className="font-medium text-accent-strong underline" href="/orgs">
              Create one
            </Link>{" "}
            and invite your team first.
          </p>
        ) : (
          <label className="block">
            <span className="label">Organisation</span>
            <select className="input" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              <option value="">Not shared (personal)</option>
              {orgs.map((o) => (
                <option key={o._id} value={o._id}>
                  {o.name} ({o.members.length} member{o.members.length === 1 ? "" : "s"})
                </option>
              ))}
            </select>
          </label>
        )}
        {error && <p className="text-sm text-bad">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          {orgs && orgs.length > 0 && (
            <button className="btn btn-primary" disabled={busy || orgId === (collab.orgId ?? "")} onClick={() => save(orgId || null)}>
              {busy ? "Saving…" : orgId ? "Share" : "Stop sharing"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { timeAgo } from "@/lib/format";
import { Badge, Card } from "./ui";

interface Member {
  userId: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  joinedAt: string;
}
interface Org {
  _id: string;
  name: string;
  myRole: "owner" | "admin" | "member";
  members: Member[];
  invites: { _id: string; email: string; role: string; createdAt: string }[];
}
interface MyInvite {
  _id: string;
  orgName: string;
  role: string;
  createdAt: string;
}

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

function OrgCard({ org, meId, reload, setError }: { org: Org; meId: string; reload: () => void; setError: (e: string) => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [msg, setMsg] = useState("");
  const manage = org.myRole === "owner" || org.myRole === "admin";
  const run = (fn: () => Promise<unknown>) => async () => {
    setError("");
    try {
      await fn();
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  };

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {org.name} <Badge tone={org.myRole === "member" ? "neutral" : "accent"}>you: {org.myRole}</Badge>
        </span>
      }
      subtitle={`${org.members.length} member${org.members.length === 1 ? "" : "s"} · shared projects and equipment appear for everyone here`}
      actions={
        <>
          {manage && (
            <button
              className="btn btn-sm"
              onClick={run(async () => {
                const name = prompt("New organisation name", org.name);
                if (name && name.trim() !== org.name) await call(`/api/orgs/${org._id}`, "PATCH", { name });
              })}
            >
              Rename
            </button>
          )}
          {org.myRole === "owner" ? (
            <button
              className="btn btn-sm text-bad"
              onClick={run(async () => {
                if (confirm(`Delete "${org.name}"? Shared projects and equipment return to their owners.`)) await call(`/api/orgs/${org._id}`, "DELETE");
              })}
            >
              Delete
            </button>
          ) : (
            <button
              className="btn btn-sm"
              onClick={run(async () => {
                if (confirm(`Leave "${org.name}"?`)) await call(`/api/orgs/${org._id}/members/${meId}`, "DELETE");
              })}
            >
              Leave
            </button>
          )}
        </>
      }
    >
      <div className="overflow-x-auto">
        <table className="table min-w-[560px]">
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Joined</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {org.members.map((m) => (
              <tr key={m.userId}>
                <td>
                  <div className="font-medium">
                    {m.name}
                    {m.userId === meId && <span className="text-muted"> (you)</span>}
                  </div>
                  <div className="text-xs text-muted">{m.email}</div>
                </td>
                <td>
                  {org.myRole === "owner" && m.role !== "owner" ? (
                    <select className="input w-auto py-1 text-xs" value={m.role} onChange={(e) => void run(() => call(`/api/orgs/${org._id}/members/${m.userId}`, "PATCH", { role: e.target.value }))()}>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <Badge tone={m.role === "owner" ? "accent" : "neutral"}>{m.role}</Badge>
                  )}
                </td>
                <td className="text-xs text-muted">{timeAgo(m.joinedAt)}</td>
                <td className="text-right">
                  {manage && m.role !== "owner" && m.userId !== meId && (org.myRole === "owner" || m.role === "member") && (
                    <button
                      className="btn btn-sm text-bad"
                      onClick={run(async () => {
                        if (confirm(`Remove ${m.name} from ${org.name}?`)) await call(`/api/orgs/${org._id}/members/${m.userId}`, "DELETE");
                      })}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {manage && (
        <div className="mt-5 space-y-3">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              try {
                const d = await call(`/api/orgs/${org._id}/invites`, "POST", { email, role });
                setMsg(d.invite.registered ? `Invitation sent: ${email} will see it on their Organisations page.` : `Invitation saved: ${email} will see it after registering with that address.`);
                setEmail("");
                reload();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Invite failed");
              }
            }}
          >
            <input className="input min-w-0 flex-1" type="email" required placeholder="colleague@company.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email to invite" />
            <select className="input w-auto" value={role} onChange={(e) => setRole(e.target.value as "member" | "admin")} aria-label="Role">
              <option value="member">Member</option>
              {org.myRole === "owner" && <option value="admin">Admin</option>}
            </select>
            <button className="btn btn-primary">Invite</button>
          </form>
          {msg && <p className="text-xs text-good">{msg}</p>}
          {org.invites.length > 0 && (
            <ul className="space-y-1 text-sm">
              {org.invites.map((i) => (
                <li key={i._id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-1.5">
                  <span>
                    {i.email} <span className="text-xs text-muted">· {i.role} · invited {timeAgo(i.createdAt)}</span>
                  </span>
                  <button className="text-xs text-bad underline" onClick={run(() => call(`/api/orgs/${org._id}/invites/${i._id}`, "DELETE"))}>
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

export function OrgsManager({ meId }: { meId: string }) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [invites, setInvites] = useState<MyInvite[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const res = await fetch("/api/orgs");
    const d = await res.json().catch(() => ({}));
    setOrgs(d.orgs ?? []);
    setInvites(d.myInvites ?? []);
    setLoading(false);
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold">Organisations</h1>
        <p className="text-sm text-muted">Work on designs together. Share a project from its header; teammates can add information, and edits to someone else&apos;s work need a comment and their approval.</p>
      </div>
      {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}

      {invites.length > 0 && (
        <Card title="Invitations for you">
          <ul className="space-y-2">
            {invites.map((i) => (
              <li key={i._id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm">
                  Join <strong>{i.orgName}</strong> as {i.role} <span className="text-xs text-muted">· {timeAgo(i.createdAt)}</span>
                </span>
                <span className="flex gap-2">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={async () => {
                      try {
                        await call(`/api/invites/${i._id}`, "POST", { action: "accept" });
                        void reload();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                  >
                    Accept
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={async () => {
                      await call(`/api/invites/${i._id}`, "POST", { action: "decline" }).catch(() => undefined);
                      void reload();
                    }}
                  >
                    Decline
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <form
        className="card flex flex-wrap items-end gap-2 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await call("/api/orgs", "POST", { name });
            setName("");
            void reload();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not create");
          }
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="label">New organisation</span>
          <input className="input" required minLength={2} placeholder="e.g. Sunrise Energy Ltd" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button className="btn btn-primary">Create</button>
      </form>

      {loading ? <p className="text-sm text-muted">Loading…</p> : orgs.length === 0 ? <p className="text-sm text-muted">You are not in any organisation yet.</p> : orgs.map((o) => <OrgCard key={o._id} org={o} meId={meId} reload={reload} setError={setError} />)}
    </main>
  );
}

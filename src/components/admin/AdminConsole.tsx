"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EquipmentItem, EquipmentType } from "@/lib/equipment-schema";
import { timeAgo } from "@/lib/format";
import { FIELDS, TABS } from "../EquipmentManager";
import { Badge, Card, Stat, cx } from "../ui";

type Section = "overview" | "library" | "users";

interface Stats {
  users: number;
  admins: number;
  projects: number;
  shared: number;
  orgs: number;
  library: number;
  verified: number;
  retired: number;
  userItems: number;
  pending: number;
}
interface AdminUser {
  _id: string;
  name: string;
  email: string;
  company: string;
  role: "user" | "admin";
  createdAt: string;
  projects: number;
  orgs: number;
  isMe: boolean;
}

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

/* ---------------- Library ---------------- */

type Form = { id: string | null; brand: string; model: string; verified: boolean; datasheetUrl: string; notes: string; chemistry: string; kind: string; specs: Record<string, string> };
const EMPTY: Form = { id: null, brand: "", model: "", verified: false, datasheetUrl: "", notes: "", chemistry: "lifepo4", kind: "hybrid", specs: {} };

function Library() {
  const [type, setType] = useState<EquipmentType>("panel");
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [showRetired, setShowRetired] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fields = type === "inverter" ? [...FIELDS.inverter, { key: "batteryVoltage", label: "Battery", unit: "V" }] : FIELDS[type];

  const load = useCallback(async () => {
    const d = await call(`/api/admin/equipment?type=${type}`, "GET").catch(() => ({ items: [] }));
    setItems(d.items);
  }, [type]);
  useEffect(() => {
    void load();
  }, [load]);

  const reset = () => {
    setForm(EMPTY);
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  function edit(i: EquipmentItem) {
    setMsg(null);
    setForm({
      id: i._id,
      brand: i.brand,
      model: i.model,
      verified: i.verified,
      datasheetUrl: i.datasheetUrl,
      notes: i.notes,
      chemistry: String(i.specs.chemistry ?? "lifepo4"),
      kind: String(i.specs.kind ?? "hybrid"),
      specs: Object.fromEntries(Object.entries(i.specs).filter(([, v]) => typeof v === "number").map(([k, v]) => [k, String(v)])),
    });
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const specs: Record<string, number | string> = {};
      for (const f of fields) {
        const v = Number(form.specs[f.key]);
        if (form.specs[f.key] !== undefined && form.specs[f.key] !== "" && Number.isFinite(v)) specs[f.key] = v;
      }
      if (type === "battery") specs.chemistry = form.chemistry;
      if (type === "inverter") specs.kind = form.kind;
      const body = { type, brand: form.brand, model: form.model, specs, verified: form.verified, datasheetUrl: form.datasheetUrl, notes: form.notes };
      const d = form.id ? await call(`/api/admin/equipment/${form.id}`, "PATCH", body) : await call("/api/admin/equipment", "POST", body);
      const id = form.id ?? d.item._id;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const r = await fetch(`/api/equipment/${id}/datasheet`, { method: "POST", body: fd });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Datasheet upload failed");
      }
      setMsg({ tone: "good", text: form.id ? "Library item updated for all users" : "Added to the library: every user can now select it" });
      reset();
      void load();
    } catch (err) {
      setMsg({ tone: "bad", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setBusy(false);
    }
  }

  async function setRetired(i: EquipmentItem, retired: boolean) {
    if (retired && !confirm(`Retire "${i.brand} ${i.model}"? Users will no longer see it; existing designs keep their values.`)) return;
    await (retired ? call(`/api/admin/equipment/${i._id}`, "DELETE") : call(`/api/admin/equipment/${i._id}`, "PATCH", { retired: false })).catch((e) => setMsg({ tone: "bad", text: e.message }));
    void load();
  }

  const shown = items.filter((i) => showRetired || !i.retired);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 border-b border-line">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setType(t.key);
                reset();
              }}
              className={cx("-mb-px border-b-2 px-4 py-2 text-sm font-medium", type === t.key ? "border-accent text-accent-strong" : "border-transparent text-muted hover:text-text")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} />
          Show retired items
        </label>
      </div>
      {msg && <p className={cx("rounded-lg px-3 py-2 text-sm", msg.tone === "good" ? "bg-good-soft text-good" : "bg-bad-soft text-bad")}>{msg.text}</p>}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="card overflow-x-auto">
          <table className="table min-w-[760px]">
            <thead>
              <tr>
                <th>Item</th>
                <th>Key specs</th>
                <th>Source</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => (
                <tr key={i._id} className={cx(i.retired && "opacity-50", form.id === i._id && "bg-accent-soft/40")}>
                  <td className="max-w-72">
                    <div className="font-medium">{i.model}</div>
                    <div className="flex flex-wrap items-center gap-1 text-xs text-muted">
                      {i.brand} {i.verified ? <Badge tone="good">✓ Verified</Badge> : <Badge>Generic</Badge>}
                      {i.retired && <Badge tone="bad">Retired</Badge>}
                      {i.datasheetUrl && (
                        <a className="text-accent-strong underline" href={i.datasheetUrl} target="_blank" rel="noopener noreferrer">
                          datasheet ↗
                        </a>
                      )}
                      {i.datasheetFile && (
                        <a className="text-accent-strong underline" href={`/api/equipment/${i._id}/datasheet`} target="_blank" rel="noopener noreferrer">
                          PDF
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="text-xs">
                    {fields
                      .slice(0, 4)
                      .filter((f) => i.specs[f.key] !== undefined)
                      .map((f) => `${f.label} ${i.specs[f.key]}${f.unit ? ` ${f.unit}` : ""}`)
                      .join(" · ")}
                  </td>
                  <td className="text-xs text-muted">{i.source === "seed" ? "Built-in seed" : "Added by admin"}</td>
                  <td className="text-right whitespace-nowrap">
                    <button className="btn btn-sm" onClick={() => edit(i)}>
                      Edit
                    </button>{" "}
                    {i.retired ? (
                      <button className="btn btn-sm" onClick={() => setRetired(i, false)}>
                        Restore
                      </button>
                    ) : (
                      <button className="btn btn-sm text-bad" onClick={() => setRetired(i, true)}>
                        Retire
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form ref={formRef} onSubmit={save} className="card h-fit space-y-3 p-5">
          <h2 className="font-semibold">{form.id ? "Edit library item" : `Add ${TABS.find((t) => t.key === type)?.label.toLowerCase().replace(/s$/, "")} to the library`}</h2>
          <p className="-mt-2 text-xs text-muted">Changes apply to every user. Mark an item verified only after checking each value against the official datasheet.</p>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="label">Brand *</span>
              <input className="input" required value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </label>
            <label>
              <span className="label">Model *</span>
              <input className="input" required value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </label>
            {type === "battery" && (
              <label className="col-span-2">
                <span className="label">Chemistry</span>
                <select className="input" value={form.chemistry} onChange={(e) => setForm({ ...form, chemistry: e.target.value })}>
                  <option value="lead_acid">Flooded lead-acid</option>
                  <option value="gel">Gel</option>
                  <option value="agm">AGM</option>
                  <option value="lifepo4">LiFePO4</option>
                </select>
              </label>
            )}
            {type === "inverter" && (
              <label className="col-span-2">
                <span className="label">Kind</span>
                <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                  <option value="hybrid">Hybrid (built-in MPPT)</option>
                  <option value="inverter_charger">Inverter/charger (needs a charge controller)</option>
                </select>
              </label>
            )}
            {fields.map((f) => (
              <label key={f.key}>
                <span className="label">
                  {f.label} {f.unit && `(${f.unit})`}
                </span>
                <input className="input num" type="number" step="any" value={form.specs[f.key] ?? ""} onChange={(e) => setForm({ ...form, specs: { ...form.specs, [f.key]: e.target.value } })} />
              </label>
            ))}
            <label className="col-span-2">
              <span className="label">Official datasheet link</span>
              <input className="input" type="url" placeholder="https://…" value={form.datasheetUrl} onChange={(e) => setForm({ ...form, datasheetUrl: e.target.value })} />
            </label>
            <label className="col-span-2">
              <span className="label">Upload datasheet (PDF or image, max 5 MB)</span>
              <input ref={fileRef} className="input text-xs" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <label className="col-span-2">
              <span className="label">Notes / source</span>
              <input className="input" maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[var(--good)]" checked={form.verified} onChange={(e) => setForm({ ...form, verified: e.target.checked })} />
              Verified against the official datasheet
            </label>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" disabled={busy}>
              {busy ? "Saving…" : form.id ? "Save changes" : "Add to library"}
            </button>
            {form.id && (
              <button type="button" className="btn" onClick={reset}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------------- Users ---------------- */

function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const d = await call("/api/admin/users", "GET").catch(() => ({ users: [] }));
    setUsers(d.users);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const shown = users.filter((u) => !q || `${u.name} ${u.email} ${u.company}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-3">
      <input className="input max-w-sm" type="search" placeholder="Search users…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
      {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      <div className="card overflow-x-auto">
        <table className="table min-w-[760px]">
          <thead>
            <tr>
              <th>User</th>
              <th>Company</th>
              <th className="text-right">Projects</th>
              <th className="text-right">Orgs</th>
              <th>Joined</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((u) => (
              <tr key={u._id}>
                <td>
                  <div className="font-medium">
                    {u.name}
                    {u.isMe && <span className="text-muted"> (you)</span>}
                  </div>
                  <div className="text-xs text-muted">{u.email}</div>
                </td>
                <td className="text-sm">{u.company || "–"}</td>
                <td className="num text-right">{u.projects}</td>
                <td className="num text-right">{u.orgs}</td>
                <td className="text-xs text-muted">{timeAgo(u.createdAt)}</td>
                <td>
                  <select
                    className="input w-auto py-1 text-xs"
                    value={u.role}
                    onChange={async (e) => {
                      setError("");
                      try {
                        await call(`/api/admin/users/${u._id}`, "PATCH", { role: e.target.value });
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Failed");
                      }
                      void load();
                    }}
                    aria-label={`Role for ${u.name}`}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Console ---------------- */

export function AdminConsole() {
  const [section, setSection] = useState<Section>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    call("/api/admin/stats", "GET")
      .then(setStats)
      .catch(() => undefined);
  }, [section]);

  return (
    <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold">Administration</h1>
        <p className="text-sm text-muted">Keep the shared equipment library up to date and manage users. Library changes are visible to everyone immediately.</p>
      </div>
      <div className="flex gap-1 border-b border-line">
        {(["overview", "library", "users"] as const).map((s) => (
          <button key={s} onClick={() => setSection(s)} className={cx("-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize", section === s ? "border-accent text-accent-strong" : "border-transparent text-muted hover:text-text")}>
            {s === "library" ? "Equipment library" : s}
          </button>
        ))}
      </div>
      {section === "overview" &&
        (stats ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Users" value={stats.users} hint={`${stats.admins} admin${stats.admins === 1 ? "" : "s"}`} />
            <Stat label="Projects" value={stats.projects} hint={`${stats.shared} shared with organisations`} />
            <Stat label="Organisations" value={stats.orgs} />
            <Stat label="Library items" value={stats.library} hint={`${stats.verified} verified · ${stats.retired} retired`} tone="accent" />
            <Stat label="Pending approvals" value={stats.pending} hint={`${stats.userItems} user-added items`} />
          </div>
        ) : (
          <p className="text-sm text-muted">Loading…</p>
        ))}
      {section === "library" && (
        <Card title="Shared equipment library" subtitle="Built-in seed items and admin-added items. Editing a seed item keeps your version even when the app ships seed updates.">
          <Library />
        </Card>
      )}
      {section === "users" && <Users />}
    </main>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EquipmentItem, EquipmentType } from "@/lib/equipment-schema";
import { timeAgo } from "@/lib/format";
import { TrafficChart, type TrafficDay } from "../charts/TrafficChart";
import { FIELDS, TABS } from "../EquipmentManager";
import { Pagination, matchesSearch, usePaged } from "../Pagination";
import { Badge, Card, Stat, cx } from "../ui";

type Section = "overview" | "library" | "submissions" | "users";

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
  submissions: number;
}
type Totals = { visitors: number; users: number; views: number };
interface Traffic {
  today: Totals;
  week: Totals;
  month: Totals;
  totalUsers: number;
  signups: { week: number; month: number };
  series: TrafficDay[];
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
  lastSeen: string | null;
}
interface Submission extends EquipmentItem {
  ownerEmail: string;
  createdAt: string | null;
  updatedAt: string | null;
  review: { status: "added" | "dismissed"; at: string | null; libraryItem: string | null; comment: string } | null;
  match: { _id: string; brand: string; model: string } | null;
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

const fieldsFor = (type: EquipmentType) => (type === "inverter" ? [...FIELDS.inverter, { key: "batteryVoltage", label: "Battery", unit: "V" }] : FIELDS[type]);

function itemToForm(i: EquipmentItem): Form {
  return {
    id: i._id,
    brand: i.brand,
    model: i.model,
    verified: i.verified,
    datasheetUrl: i.datasheetUrl,
    notes: i.notes,
    chemistry: String(i.specs.chemistry ?? "lifepo4"),
    kind: String(i.specs.kind ?? "hybrid"),
    specs: Object.fromEntries(Object.entries(i.specs).filter(([, v]) => typeof v === "number").map(([k, v]) => [k, String(v)])),
  };
}

function formToBody(type: EquipmentType, form: Form) {
  const specs: Record<string, number | string> = {};
  for (const f of fieldsFor(type)) {
    const v = Number(form.specs[f.key]);
    if (form.specs[f.key] !== undefined && form.specs[f.key] !== "" && Number.isFinite(v)) specs[f.key] = v;
  }
  if (type === "battery") specs.chemistry = form.chemistry;
  if (type === "inverter") specs.kind = form.kind;
  return { brand: form.brand, model: form.model, specs, verified: form.verified, datasheetUrl: form.datasheetUrl, notes: form.notes };
}

/** Brand, model, type-specific specs, datasheet link, notes and the verified flag. */
function ItemFields({ type, form, setForm }: { type: EquipmentType; form: Form; setForm: (f: Form) => void }) {
  return (
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
      {fieldsFor(type).map((f) => (
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
        <span className="label">Notes / source</span>
        <input className="input" maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </label>
      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-[var(--good)]" checked={form.verified} onChange={(e) => setForm({ ...form, verified: e.target.checked })} />
        Verified against the official datasheet
      </label>
    </div>
  );
}

function Library() {
  const [type, setType] = useState<EquipmentType>("panel");
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [showRetired, setShowRetired] = useState(false);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fields = fieldsFor(type);

  const latestRequest = useRef(0);
  const load = useCallback(async () => {
    const id = ++latestRequest.current;
    const d = await call(`/api/admin/equipment?type=${type}`, "GET").catch(() => ({ items: [] }));
    if (id === latestRequest.current) setItems(d.items); // ignore responses for a tab already left
  }, [type]);
  useEffect(() => {
    void load();
  }, [load]);

  const reset = () => {
    setForm(EMPTY);
  };

  function edit(i: EquipmentItem) {
    setMsg(null);
    setForm(itemToForm(i));
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const body = { type, ...formToBody(type, form) };
      if (form.id) await call(`/api/admin/equipment/${form.id}`, "PATCH", body);
      else await call("/api/admin/equipment", "POST", body);
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

  const shown = items.filter((i) => (showRetired || !i.retired) && matchesSearch(query, i.brand, i.model, i.notes, i.verified ? "verified" : "generic", ...Object.values(i.specs)));
  const paged = usePaged(shown, `${type}|${query}|${showRetired}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 border-b border-line">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setType(t.key);
                setQuery("");
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-3">
        <input className="input" type="search" placeholder="Search by brand, model, notes or a value…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search the library" />
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
              {paged.slice.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted">
                    No items match.
                  </td>
                </tr>
              )}
              {paged.slice.map((i) => (
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
                    </div>
                  </td>
                  <td className="text-xs">
                    {fields
                      .slice(0, 4)
                      .filter((f) => i.specs[f.key] !== undefined)
                      .map((f) => `${f.label} ${i.specs[f.key]}${f.unit ? ` ${f.unit}` : ""}`)
                      .join(" · ")}
                  </td>
                  <td className="text-xs text-muted">{i.source === "seed" ? "Built-in seed" : i.contributedByName ? `From ${i.contributedByName}` : "Added by admin"}</td>
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
        <Pagination {...paged} noun="items" />
        </div>

        <form ref={formRef} onSubmit={save} className="card h-fit space-y-3 p-5">
          <h2 className="font-semibold">{form.id ? "Edit library item" : `Add ${TABS.find((t) => t.key === type)?.label.toLowerCase().replace(/s$/, "")} to the library`}</h2>
          <p className="-mt-2 text-xs text-muted">Changes apply to every user. Mark an item verified only after checking each value against the official datasheet.</p>
          <ItemFields type={type} form={form} setForm={setForm} />
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

/* ---------------- User submissions ---------------- */

type SubStatus = "pending" | "added" | "dismissed";
type Review = { sub: Submission; form: Form; target: { _id: string; label: string } | null; mode: "new" | "update" };
const TYPE_LABEL = Object.fromEntries(TABS.map((t) => [t.key, t.label.replace(/s$/, "")])) as Record<EquipmentType, string>;

function Submissions({ onChanged }: { onChanged: () => void }) {
  const [status, setStatus] = useState<SubStatus>("pending");
  const [type, setType] = useState<EquipmentType | "">("");
  const [items, setItems] = useState<Submission[]>([]);
  const [counts, setCounts] = useState<Partial<Record<SubStatus, number>>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const latestRequest = useRef(0);
  const load = useCallback(async () => {
    const id = ++latestRequest.current;
    setLoading(true);
    const d = await call(`/api/admin/submissions?status=${status}${type ? `&type=${type}` : ""}`, "GET").catch(() => ({ items: [], counts: {} }));
    if (id !== latestRequest.current) return; // a newer filter is already loading
    setItems(d.items);
    setCounts(d.counts);
    setLoading(false);
  }, [status, type]);
  useEffect(() => {
    void load();
  }, [load]);

  function open(sub: Submission) {
    setMsg(null);
    const target = sub.match ? { _id: sub.match._id, label: `${sub.match.brand} ${sub.match.model}`.trim() } : null;
    setReview({ sub, form: { ...itemToForm(sub), verified: false }, target, mode: target ? "update" : "new" });
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  async function act(sub: Submission, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/submissions/${sub._id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!review) return;
    setBusy(true);
    setMsg(null);
    const { sub, form, target, mode } = review;
    const { ok, data } = await act(sub, { action: "add", item: formToBody(sub.type, form), targetId: mode === "update" ? target?._id : undefined });
    setBusy(false);
    if (ok) {
      setMsg({ tone: "good", text: mode === "update" ? `Library item "${target?.label}" updated with these values for every user` : `"${form.brand} ${form.model}" added to the global library for every user` });
      setReview(null);
      void load();
      onChanged();
    } else if (data.code === "duplicate") {
      setReview({ ...review, target: { _id: data.matchId, label: `${form.brand} ${form.model}` }, mode: "update" });
      setMsg({ tone: "bad", text: "The library already has this brand and model. Choose “Update the existing library item” to apply these values to it, or change the model name." });
    } else setMsg({ tone: "bad", text: data.error ?? "Could not add the item" });
  }

  async function dismiss(sub: Submission) {
    const comment = window.prompt(`Dismiss "${sub.brand} ${sub.model}"? It stays in ${sub.ownerName || "the user"}'s own library.\n\nOptional note (why it was not added):`, "");
    if (comment === null) return;
    const { ok, data } = await act(sub, { action: "dismiss", comment });
    if (!ok) setMsg({ tone: "bad", text: data.error ?? "Could not dismiss" });
    if (review?.sub._id === sub._id) setReview(null);
    void load();
    onChanged();
  }

  async function reopen(sub: Submission) {
    const { ok, data } = await act(sub, { action: "reopen" });
    if (!ok) setMsg({ tone: "bad", text: data.error ?? "Could not reopen" });
    void load();
    onChanged();
  }

  const shown = items.filter((i) => matchesSearch(query, i.brand, i.model, i.notes, i.ownerName, i.ownerEmail, i.orgName, ...Object.values(i.specs)));
  const paged = usePaged(shown, `${status}|${type}|${query}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 border-b border-line">
          {(["pending", "added", "dismissed"] as const).map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatus(st);
                setReview(null);
              }}
              className={cx("-mb-px border-b-2 px-4 py-2 text-sm font-medium", status === st ? "border-accent text-accent-strong" : "border-transparent text-muted hover:text-text")}
            >
              {st === "pending" ? "To review" : st === "added" ? "Added to library" : "Dismissed"}
              {counts[st] ? <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 text-[11px]">{counts[st]}</span> : null}
            </button>
          ))}
        </div>
        <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value as EquipmentType | "")} aria-label="Equipment type">
          <option value="">All types</option>
          {TABS.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      {msg && <p className={cx("rounded-lg px-3 py-2 text-sm", msg.tone === "good" ? "bg-good-soft text-good" : "bg-bad-soft text-bad")}>{msg.text}</p>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-3">
          <input className="input" type="search" placeholder="Search by model, brand, user or a value…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search submissions" />
          <div className="card overflow-x-auto">
            <table className="table min-w-[820px]">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Key specs</th>
                  <th>Added by</th>
                  <th>Global library</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {paged.slice.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted">
                      {loading ? "Loading…" : status === "pending" ? "Nothing to review: no new equipment from users." : "No items here."}
                    </td>
                  </tr>
                )}
                {paged.slice.map((i) => (
                  <tr key={i._id} className={cx(review?.sub._id === i._id && "bg-accent-soft/40")}>
                    <td className="max-w-64">
                      <div className="font-medium">{i.model}</div>
                      <div className="flex flex-wrap items-center gap-1 text-xs text-muted">
                        {i.brand || "No brand"} <Badge>{TYPE_LABEL[i.type]}</Badge>
                        {i.datasheetUrl && (
                          <a className="text-accent-strong underline" href={i.datasheetUrl} target="_blank" rel="noopener noreferrer">
                            datasheet ↗
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="max-w-72 text-xs">
                      {fieldsFor(i.type)
                        .slice(0, 4)
                        .filter((f) => i.specs[f.key] !== undefined)
                        .map((f) => `${f.label} ${i.specs[f.key]}${f.unit ? ` ${f.unit}` : ""}`)
                        .join(" · ")}
                    </td>
                    <td className="text-xs">
                      <div className="font-medium">{i.ownerName || "–"}</div>
                      <div className="text-muted">{i.ownerEmail}</div>
                      <div className="text-muted">
                        {i.orgName ? `Shared with ${i.orgName} · ` : ""}
                        {i.updatedAt ? timeAgo(i.updatedAt) : ""}
                      </div>
                    </td>
                    <td className="text-xs">
                      {i.review?.status === "added" ? (
                        <Badge tone="good">✓ Added {i.review.at ? timeAgo(i.review.at) : ""}</Badge>
                      ) : i.review?.status === "dismissed" ? (
                        <span className="text-muted">
                          <Badge>Dismissed</Badge> {i.review.comment}
                        </span>
                      ) : i.match ? (
                        <Badge tone="warn">Same model already in library</Badge>
                      ) : (
                        <Badge tone="info">New model</Badge>
                      )}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      {i.review?.status !== "added" && (
                        <button className="btn btn-sm btn-primary" onClick={() => open(i)}>
                          Review
                        </button>
                      )}{" "}
                      {!i.review && (
                        <button className="btn btn-sm" onClick={() => dismiss(i)}>
                          Dismiss
                        </button>
                      )}
                      {i.review && (
                        <button className="btn btn-sm" onClick={() => reopen(i)} title="Put back in the review queue">
                          Reopen
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...paged} noun="items" />
        </div>

        {review ? (
          <form ref={formRef} onSubmit={add} className="card h-fit space-y-3 p-5">
            <h2 className="font-semibold">Review {TYPE_LABEL[review.sub.type].toLowerCase()} for the global library</h2>
            <p className="-mt-2 text-xs text-muted">
              Added by {review.sub.ownerName || "a user"}. Check every value against the official datasheet and correct anything before adding. The user&apos;s own copy is not changed.
            </p>
            {review.target && (
              <fieldset className="space-y-1.5 rounded-lg border border-line p-3 text-sm">
                <legend className="px-1 text-xs font-medium text-muted">The library already has “{review.target.label}”</legend>
                <label className="flex items-center gap-2">
                  <input type="radio" className="accent-[var(--accent)]" checked={review.mode === "update"} onChange={() => setReview({ ...review, mode: "update" })} />
                  Update the existing library item with these values
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" className="accent-[var(--accent)]" checked={review.mode === "new"} onChange={() => setReview({ ...review, mode: "new" })} />
                  Add as a separate item (change the model name)
                </label>
              </fieldset>
            )}
            <ItemFields type={review.sub.type} form={review.form} setForm={(form) => setReview({ ...review, form })} />
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" disabled={busy}>
                {busy ? "Saving…" : review.mode === "update" ? "Update library item" : "Add to global library"}
              </button>
              <button type="button" className="btn" onClick={() => setReview(null)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="card h-fit space-y-2 p-5 text-sm">
            <h2 className="font-semibold">How reviewing works</h2>
            <p className="text-muted">Users&apos; personal equipment appears here. Choose Review to check and correct the values, then add it to the global library so every user can select it.</p>
            <p className="text-muted">If the library already has the same brand and model, you can update that item with the new values instead of creating a duplicate.</p>
            <p className="text-muted">Dismissed items stay in the user&apos;s own library. If they edit the item later, it returns to this queue.</p>
          </div>
        )}
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
              <th>Last active</th>
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
                <td className="text-xs text-muted">{u.lastSeen ? timeAgo(u.lastSeen) : "–"}</td>
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

/* ---------------- Overview ---------------- */

function Traffic() {
  const [data, setData] = useState<Traffic | null>(null);
  useEffect(() => {
    call("/api/admin/analytics?days=30", "GET")
      .then(setData)
      .catch(() => undefined);
  }, []);
  if (!data) return <p className="text-sm text-muted">Loading visitor figures…</p>;
  return (
    <Card title="Visitors and users" subtitle="Unique devices that opened the app, and how many of them were signed in. Counted per UTC day; no IP addresses are stored.">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Visitors today" value={data.today.visitors} hint={`${data.today.users} signed-in users · ${data.today.views} page views`} tone="accent" />
        <Stat label="Visitors, last 7 days" value={data.week.visitors} hint={`${data.week.users} signed-in users · ${data.week.views} page views`} />
        <Stat label="Visitors, last 30 days" value={data.month.visitors} hint={`${data.month.users} signed-in users · ${data.month.views} page views`} />
        <Stat label="Registered users" value={data.totalUsers} hint={`+${data.signups.week} this week · +${data.signups.month} in 30 days`} />
      </div>
      <div className="mt-5">
        <TrafficChart series={data.series} />
      </div>
    </Card>
  );
}

/* ---------------- Console ---------------- */

export function AdminConsole() {
  const [section, setSection] = useState<Section>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const loadStats = useCallback(() => {
    call("/api/admin/stats", "GET")
      .then(setStats)
      .catch(() => undefined);
  }, []);
  useEffect(loadStats, [section, loadStats]);

  return (
    <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold">Administration</h1>
        <p className="text-sm text-muted">Track visitors, keep the shared equipment library up to date, review equipment from users and manage accounts. Library changes are visible to everyone immediately.</p>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-line">
        {(["overview", "library", "submissions", "users"] as const).map((s) => (
          <button key={s} onClick={() => setSection(s)} className={cx("-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap capitalize sm:px-4", section === s ? "border-accent text-accent-strong" : "border-transparent text-muted hover:text-text")}>
            {s === "library" ? "Equipment library" : s === "submissions" ? "User equipment" : s}
            {s === "submissions" && stats?.submissions ? <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">{stats.submissions}</span> : null}
          </button>
        ))}
      </div>
      {section === "overview" && <Traffic />}
      {section === "overview" &&
        (stats ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Users" value={stats.users} hint={`${stats.admins} admin${stats.admins === 1 ? "" : "s"}`} />
            <Stat label="Projects" value={stats.projects} hint={`${stats.shared} shared with organisations`} />
            <Stat label="Organisations" value={stats.orgs} />
            <Stat label="Library items" value={stats.library} hint={`${stats.verified} verified · ${stats.retired} retired`} tone="accent" />
            <Stat label="Pending approvals" value={stats.pending} hint="Change requests in organisations" />
            <button className="text-left" onClick={() => setSection("submissions")}>
              <Stat label="User equipment to review" value={stats.submissions} hint={`${stats.userItems} items in users' libraries`} tone={stats.submissions ? "warn" : undefined} />
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted">Loading…</p>
        ))}
      {section === "library" && (
        <Card title="Shared equipment library" subtitle="Built-in seed items and admin-added items. Editing a seed item keeps your version even when the app ships seed updates.">
          <Library />
        </Card>
      )}
      {section === "submissions" && (
        <Card title="Equipment added by users" subtitle="Review items from users' personal libraries and add the good ones to the global library.">
          <Submissions onChanged={loadStats} />
        </Card>
      )}
      {section === "users" && <Users />}
    </main>
  );
}

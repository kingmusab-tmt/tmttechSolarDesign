"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CecModule } from "@/lib/cec";
import type { EquipmentItem, EquipmentType } from "@/lib/equipment-schema";
import { CecModuleSearch } from "./CecModuleSearch";
import { Pagination, matchesSearch, usePaged } from "./Pagination";
import { Badge, cx } from "./ui";

export const FIELDS: Record<EquipmentType, { key: string; label: string; unit: string }[]> = {
  panel: [
    { key: "pmaxW", label: "Pmax", unit: "W" },
    { key: "vocV", label: "Voc", unit: "V" },
    { key: "vmpV", label: "Vmp", unit: "V" },
    { key: "iscA", label: "Isc", unit: "A" },
    { key: "impA", label: "Imp", unit: "A" },
    { key: "betaVocPct", label: "β Voc", unit: "%/°C" },
    { key: "gammaPmaxPct", label: "γ Pmax", unit: "%/°C" },
    { key: "noctC", label: "NOCT", unit: "°C" },
    { key: "lengthM", label: "Length", unit: "m" },
    { key: "widthM", label: "Width", unit: "m" },
    { key: "weightKg", label: "Weight", unit: "kg" },
  ],
  inverter: [
    { key: "ratedPowerW", label: "Rated", unit: "W" },
    { key: "surgePowerW", label: "Surge", unit: "W" },
    { key: "maxPvVoltage", label: "Max PV V", unit: "V" },
    { key: "mpptMinV", label: "MPPT min", unit: "V" },
    { key: "mpptMaxV", label: "MPPT max", unit: "V" },
    { key: "maxPvPowerW", label: "Max PV", unit: "W" },
    { key: "maxPvInputCurrentA", label: "Max I/MPPT", unit: "A" },
    { key: "maxPvIscA", label: "Max Isc/MPPT", unit: "A" },
    { key: "mpptCount", label: "MPPTs", unit: "" },
    { key: "maxChargeCurrentA", label: "Max charge", unit: "A" },
  ],
  battery: [
    { key: "unitVoltage", label: "Voltage", unit: "V" },
    { key: "unitAh", label: "Capacity", unit: "Ah" },
    { key: "dod", label: "DoD", unit: "" },
    { key: "maxChargeCRate", label: "Max charge", unit: "C" },
    { key: "maxDischargeCRate", label: "Max discharge", unit: "C" },
  ],
  controller: [
    { key: "ratedCurrentA", label: "Rated", unit: "A" },
    { key: "maxPvVoltage", label: "Max PV V", unit: "V" },
    { key: "maxPvPowerW", label: "Max PV", unit: "W" },
  ],
};

export const TABS: { key: EquipmentType; label: string }[] = [
  { key: "panel", label: "PV modules" },
  { key: "inverter", label: "Inverters" },
  { key: "battery", label: "Batteries" },
  { key: "controller", label: "Charge controllers" },
];

type FormState = { id: string | null; brand: string; model: string; chemistry: string; kind: string; datasheetUrl: string; notes: string; specs: Record<string, string>; suggest: boolean; comment: string };
const EMPTY_FORM: FormState = { id: null, brand: "", model: "", chemistry: "lifepo4", kind: "hybrid", datasheetUrl: "", notes: "", specs: {}, suggest: false, comment: "" };

export function EquipmentManager() {
  const [tab, setTab] = useState<EquipmentType>("panel");
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showCec, setShowCec] = useState(false);
  const [cecBusy, setCecBusy] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [orgs, setOrgs] = useState<{ _id: string; name: string }[]>([]);
  useEffect(() => {
    fetch("/api/orgs")
      .then((r) => (r.ok ? r.json() : { orgs: [] }))
      .then((d) => setOrgs(d.orgs ?? []))
      .catch(() => undefined);
  }, []);
  const formRef = useRef<HTMLFormElement>(null);

  // Only the latest request may update the list: switching tabs quickly must never show a
  // previous tab's items when its slower response arrives last.
  const latestRequest = useRef(0);
  const load = useCallback(async () => {
    const id = ++latestRequest.current;
    setLoading(true);
    const res = await fetch(`/api/equipment?type=${tab}`).catch(() => null);
    const data = res ? await res.json().catch(() => ({ items: [] })) : { items: [] };
    if (id !== latestRequest.current) return;
    setItems(data.items ?? []);
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  function switchTab(t: EquipmentType) {
    if (t !== tab) setItems([]);
    setTab(t);
    setQuery("");
    resetForm();
    setShowCec(false);
    setError("");
    setMessage("");
  }

  function edit(i: EquipmentItem) {
    setError("");
    setMessage("");
    setForm({
      id: i._id,
      brand: i.brand,
      model: i.model,
      chemistry: String(i.specs.chemistry ?? "lifepo4"),
      kind: String(i.specs.kind ?? "hybrid"),
      datasheetUrl: i.datasheetUrl,
      notes: i.notes,
      specs: Object.fromEntries(Object.entries(i.specs).filter(([, v]) => typeof v === "number").map(([k, v]) => [k, String(v)])),
      // A teammate's shared item: the edit becomes a proposal for its creator to approve.
      suggest: !i.mine,
      comment: "",
    });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    const specs: Record<string, number | string> = {};
    for (const f of FIELDS[tab]) {
      const v = Number(form.specs[f.key]);
      if (form.specs[f.key] !== undefined && form.specs[f.key] !== "" && Number.isFinite(v)) specs[f.key] = v;
    }
    if (tab === "battery") specs.chemistry = form.chemistry;
    if (tab === "inverter" && editing?.specs.kind) specs.kind = form.kind;
    if (form.suggest && form.comment.trim().length < 3) return setError("Explain your suggested change in a comment (at least 3 characters)");
    setSaving(true);
    try {
      const value = { type: tab, brand: form.brand, model: form.model, specs, datasheetUrl: form.datasheetUrl, notes: form.notes };
      if (form.suggest && form.id) {
        const r = await fetch(`/api/equipment/${form.id}/changes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value, comment: form.comment.trim() }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Could not submit your suggestion");
        setMessage(`Suggestion sent to ${editing?.ownerName || "the creator"} for approval. Track it under Approvals.`);
        resetForm();
        return;
      }
      const body = JSON.stringify(value);
      const res = await fetch(form.id ? `/api/equipment/${form.id}` : "/api/equipment", { method: form.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save");
      setMessage(form.id ? "Item updated" : "Item added to your library");
      resetForm();
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function addFromCec(m: CecModule) {
    setCecBusy(m.id);
    setError("");
    setMessage("");
    const notes = `CEC module list (NREL SAM). Weight estimated${m.dimsEstimated ? "; dimensions estimated from area" : ""}. Verify against the manufacturer datasheet.`;
    const res = await fetch("/api/equipment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "panel", brand: m.manufacturer, model: m.model, specs: m.specs, notes }) });
    const data = await res.json().catch(() => ({}));
    setCecBusy(null);
    if (!res.ok) return setError(data.error || "Could not add module");
    setMessage(`${m.manufacturer} ${m.model} added to your library. Use Edit to enter the real weight and add the manufacturer's datasheet link.`);
    void load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this item from your library?")) return;
    await fetch(`/api/equipment/${id}`, { method: "DELETE" });
    if (form.id === id) resetForm();
    void load();
  }

  const tabLabel = TABS.find((t) => t.key === tab)?.label.toLowerCase().replace(/s$/, "") ?? "item";
  const editing = form.id ? items.find((i) => i._id === form.id) : undefined;
  // Items whose brand/model alone match rank above matches found only in notes or values.
  const filtered = items
    .filter((i) => matchesSearch(query, i.brand, i.model, i.notes, i.ownerName, i.orgName, i.verified ? "verified" : i.builtIn ? "generic" : "", i.mine ? "mine" : "", ...Object.values(i.specs)))
    .map((i, idx) => ({ i, idx, direct: query ? matchesSearch(query, i.brand, i.model) : true }))
    .sort((a, b) => Number(b.direct) - Number(a.direct) || a.idx - b.idx)
    .map((x) => x.i);
  const paged = usePaged(filtered, `${tab}|${query}`);
  const fields = FIELDS[tab];

  const badge = (i: EquipmentItem) =>
    i.builtIn ? (
      i.verified ? (
        <Badge tone="good">✓ Verified datasheet</Badge>
      ) : (
        <Badge>Generic</Badge>
      )
    ) : i.mine ? (
      <>
        <Badge tone="accent">Mine{i.orgName ? ` · shared with ${i.orgName}` : ""}</Badge>
        {i.libraryStatus === "added" && <Badge tone="good">✓ Added to global library</Badge>}
      </>
    ) : (
      <Badge tone="info">
        👥 {i.orgName} · by {i.ownerName}
      </Badge>
    );

  const datasheet = (i: EquipmentItem) => (
    <>
      {i.datasheetUrl && (
        <a className="block text-accent-strong underline" href={i.datasheetUrl} target="_blank" rel="noopener noreferrer">
          {i.builtIn ? "Official datasheet ↗" : "Manufacturer ↗"}
        </a>
      )}
      {!i.datasheetUrl && <span className="text-muted">{i.builtIn ? "Generic values" : "None"}</span>}
    </>
  );

  const actions = (i: EquipmentItem) => (
    <>
      {i.mine && (
        <>
          {orgs.length > 0 && (
            <select
              className="input inline-block w-auto py-1 text-xs"
              value={i.orgId ?? ""}
              onChange={async (e) => {
                const r = await fetch(`/api/equipment/${i._id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgId: e.target.value || null }) });
                if (!r.ok) setError((await r.json().catch(() => ({}))).error ?? "Could not change sharing");
                void load();
              }}
              aria-label="Share with organisation"
              title="Share with an organisation"
            >
              <option value="">Private</option>
              {orgs.map((o) => (
                <option key={o._id} value={o._id}>
                  Share: {o.name}
                </option>
              ))}
            </select>
          )}
          <button className="btn btn-sm" onClick={() => edit(i)}>
            Edit
          </button>
          <button className="btn btn-sm text-bad" onClick={() => remove(i._id)}>
            Delete
          </button>
        </>
      )}
      {!i.builtIn && !i.mine && (
        <button className="btn btn-sm" onClick={() => edit(i)} title={`Propose a change for ${i.ownerName} to approve`}>
          Suggest change
        </button>
      )}
    </>
  );
  const specValue = (i: EquipmentItem, key: string) =>
    // 0 means "not applicable / not stated" (e.g. no built-in MPPT)
    i.specs[key] === undefined || i.specs[key] === 0 ? <span className="text-muted">–</span> : i.specs[key];

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">Equipment library</h1>
      <p className="text-sm text-muted">
        Real products verified against official manufacturer datasheets (✓), the CEC database of 21,677 PV modules, generic placeholders for gaps, and your own products with their original datasheets. Any item can be applied to a design from the sizing steps.
      </p>

      <div className="mt-6 flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => switchTab(t.key)} className={cx("-mb-px border-b-2 px-4 py-2 text-sm font-medium", tab === t.key ? "border-accent text-accent-strong" : "border-transparent text-muted hover:text-text")}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      {message && <p className="mt-4 rounded-lg bg-good-soft px-3 py-2 text-sm text-good">{message}</p>}

      {tab === "panel" && (
        <div className="card mt-6 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Real module datasheets: CEC database</h2>
              <p className="text-xs text-muted">21,677 certified modules (Jinko, LONGi, Canadian Solar, JA Solar, Trina and more) with the electrical and temperature data that string sizing needs.</p>
            </div>
            <button className="btn btn-sm" onClick={() => setShowCec((v) => !v)}>
              {showCec ? "Hide search" : "Search modules"}
            </button>
          </div>
          {showCec && (
            <div className="mt-4">
              <CecModuleSearch actionLabel="Add to my library" onSelect={addFromCec} busyId={cecBusy} />
            </div>
          )}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input min-w-0 flex-1"
              type="search"
              placeholder={`Search ${TABS.find((t) => t.key === tab)?.label.toLowerCase()} by brand, model, notes or a value…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search this list"
            />
            <span className="text-xs text-muted">
              {query ? `${filtered.length} of ${items.length} match` : `${items.length} items`}
            </span>
          </div>

          {/* Phones: compact cards */}
          <ul className="space-y-3 md:hidden">
            {loading && <li className="card p-4 text-center text-sm text-muted">Loading…</li>}
            {!loading && paged.slice.length === 0 && <li className="card p-4 text-center text-sm text-muted">No items match your search.</li>}
            {paged.slice.map((i) => (
              <li key={i._id} className={cx("card p-4", form.id === i._id && "border-accent")}>
                <div className="font-medium">{i.model}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted">
                  {i.brand} {badge(i)}
                  {tab === "battery" && <span>· {String(i.specs.chemistry ?? "")}</span>}
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2 text-xs">
                  {fields.map((f) => (
                    <div key={f.key} className="min-w-0">
                      <dt className="truncate text-muted">
                        {f.label}
                        {f.unit && ` (${f.unit})`}
                      </dt>
                      <dd className="num font-medium">{specValue(i, f.key)}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 text-xs">{datasheet(i)}</div>
                <div className="mt-3 flex flex-wrap gap-2">{actions(i)}</div>
              </li>
            ))}
          </ul>

          {/* Tablets and desktops: table with compact numeric columns */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="table">
              <thead>
                <tr>
                  <th className="min-w-56">Model</th>
                  {tab === "battery" && <th className="w-px whitespace-nowrap">Chemistry</th>}
                  {fields.map((f) => (
                    <th key={f.key} className="w-px text-right whitespace-nowrap">
                      {f.label}
                      {f.unit && <span className="block font-normal normal-case">({f.unit})</span>}
                    </th>
                  ))}
                  <th className="w-px whitespace-nowrap">Datasheet</th>
                  <th className="w-px" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={20} className="py-8 text-center text-muted">
                      Loading…
                    </td>
                  </tr>
                ) : paged.slice.length === 0 ? (
                  <tr>
                    <td colSpan={20} className="py-8 text-center text-muted">
                      No items match your search.
                    </td>
                  </tr>
                ) : (
                  paged.slice.map((i) => (
                    <tr key={i._id} className={cx(form.id === i._id && "bg-accent-soft/40")}>
                      <td className="min-w-56">
                        <div className="font-medium">{i.model}</div>
                        <div className="text-xs text-muted">
                          {i.brand} {badge(i)}
                        </div>
                        {i.notes && (
                          <div className="mt-0.5 line-clamp-2 max-w-md text-[11px] leading-snug text-muted" title={i.notes}>
                            {i.notes}
                          </div>
                        )}
                      </td>
                      {tab === "battery" && <td className="text-xs whitespace-nowrap">{String(i.specs.chemistry ?? "")}</td>}
                      {fields.map((f) => (
                        <td key={f.key} className="num text-right whitespace-nowrap">
                          {specValue(i, f.key)}
                        </td>
                      ))}
                      <td className="text-xs whitespace-nowrap">{datasheet(i)}</td>
                      <td>
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">{actions(i)}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination {...paged} noun={TABS.find((t) => t.key === tab)?.label.toLowerCase()} />
        </div>

        <form ref={formRef} onSubmit={save} className="card h-fit space-y-3 p-5">
          <h2 className="font-semibold">{form.suggest ? `Suggest a change to ${editing?.model ?? tabLabel}` : form.id ? `Edit ${editing?.model ?? tabLabel}` : `Add ${tabLabel}`}</h2>
          <p className="-mt-2 text-xs text-muted">
            {form.suggest
              ? `${editing?.ownerName ?? "The creator"} created this shared item. Your change is applied only after they approve it.`
              : "Enter the values from the manufacturer's datasheet and link the original for traceability. Administrators may review items you add and include them in the global library for everyone."}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="label">Brand</span>
              <input className="input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </label>
            <label>
              <span className="label">Model *</span>
              <input className="input" required value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </label>
            {tab === "battery" && (
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
            {FIELDS[tab].map((f) => (
              <label key={f.key}>
                <span className="label">
                  {f.label} {f.unit && `(${f.unit})`}
                </span>
                <input className="input num" type="number" step="any" value={form.specs[f.key] ?? ""} onChange={(e) => setForm({ ...form, specs: { ...form.specs, [f.key]: e.target.value } })} />
              </label>
            ))}
            <label className="col-span-2">
              <span className="label">Manufacturer datasheet link</span>
              <input className="input" type="url" placeholder="https://…" value={form.datasheetUrl} onChange={(e) => setForm({ ...form, datasheetUrl: e.target.value })} />
            </label>
            <label className="col-span-2">
              <span className="label">Notes / source</span>
              <input className="input" maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            {form.suggest && (
              <label className="col-span-2">
                <span className="label">Comment for the creator *</span>
                <textarea className="input min-h-16" required minLength={3} maxLength={2000} placeholder="What you changed and why" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
              </label>
            )}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" disabled={saving}>
              {saving ? "Saving…" : form.suggest ? "Submit for approval" : form.id ? "Save changes" : "Save to my library"}
            </button>
            {form.id && (
              <button type="button" className="btn" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}

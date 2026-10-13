"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LOCATIONS } from "@/lib/locations";

export function NewProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [locationPreset, setLocation] = useState("lagos");
  const [withSample, setWithSample] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "New solar design", clientName, locationPreset, withSample }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create project");
      router.push(`/projects/${data.project._id}/site`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={create} className="card space-y-4 p-5">
      <div>
        <h2 className="font-semibold">New design project</h2>
        <p className="text-xs text-muted">Every design follows the 15-step engineering workflow.</p>
      </div>
      <label className="block">
        <span className="label">Project name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Adeyemi residence, Lekki" />
      </label>
      <label className="block">
        <span className="label">Client name</span>
        <input className="input" value={clientName} onChange={(e) => setClientName(e.target.value)} />
      </label>
      <label className="block">
        <span className="label">Location</span>
        <select className="input" value={locationPreset} onChange={(e) => setLocation(e.target.value)}>
          {LOCATIONS.map((l) => (
            <option key={l.key} value={l.key}>
              {l.city}, {l.state} ({l.peakSunHours} PSH)
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={withSample} onChange={(e) => setWithSample(e.target.checked)} />
        Start with a sample 3-bedroom load list
      </label>
      {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>
        {busy ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Msg = { tone: "good" | "bad"; text: string } | null;

function Message({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return <p className={`rounded-lg px-3 py-2 text-sm ${msg.tone === "good" ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>{msg.text}</p>;
}

export function AccountForm() {
  const router = useRouter();
  const [profile, setProfile] = useState({ name: "", email: "", company: "" });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [profileMsg, setProfileMsg] = useState<Msg>(null);
  const [pwMsg, setPwMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.json())
      .then((d) => d.user && setProfile(d.user))
      .catch(() => undefined);
  }, []);

  async function patch(body: Record<string, string>) {
    setBusy(true);
    try {
      const res = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Update failed");
      router.refresh();
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Update failed";
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="text-sm text-muted">{profile.email}</p>
      </div>

      <form
        className="card space-y-4 p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          const err = await patch({ name: profile.name, company: profile.company });
          setProfileMsg(err ? { tone: "bad", text: err } : { tone: "good", text: "Profile updated" });
        }}
      >
        <h2 className="font-semibold">Profile</h2>
        <p className="-mt-2 text-xs text-muted">Your company name appears on design reports.</p>
        <label className="block">
          <span className="label">Full name</span>
          <input className="input" required minLength={2} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
        </label>
        <label className="block">
          <span className="label">Company</span>
          <input className="input" value={profile.company} onChange={(e) => setProfile({ ...profile, company: e.target.value })} />
        </label>
        <Message msg={profileMsg} />
        <button className="btn btn-primary" disabled={busy}>
          Save profile
        </button>
      </form>

      <form
        className="card space-y-4 p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          if (pw.newPassword !== pw.confirm) return setPwMsg({ tone: "bad", text: "New passwords do not match" });
          const err = await patch({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
          if (err) return setPwMsg({ tone: "bad", text: err });
          setPw({ currentPassword: "", newPassword: "", confirm: "" });
          setPwMsg({ tone: "good", text: "Password changed" });
        }}
      >
        <h2 className="font-semibold">Change password</h2>
        <label className="block">
          <span className="label">Current password</span>
          <input className="input" type="password" required autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">New password</span>
            <input className="input" type="password" required minLength={8} autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
          </label>
          <label className="block">
            <span className="label">Confirm new password</span>
            <input className="input" type="password" required minLength={8} autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          </label>
        </div>
        <Message msg={pwMsg} />
        <button className="btn btn-primary" disabled={busy}>
          Change password
        </button>
      </form>
    </main>
  );
}

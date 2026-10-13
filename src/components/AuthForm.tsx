"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", company: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-16">
      <h1 className="text-2xl font-bold">{mode === "login" ? "Sign in" : "Create your account"}</h1>
      <p className="mt-1 text-sm text-muted">{mode === "login" ? "Welcome back. Continue your designs." : "Start designing solar home systems in minutes."}</p>
      <form onSubmit={submit} className="card mt-6 space-y-4 p-6">
        {mode === "register" && (
          <>
            <label className="block">
              <span className="label">Full name</span>
              <input className="input" required minLength={2} value={form.name} onChange={set("name")} autoComplete="name" />
            </label>
            <label className="block">
              <span className="label">Company (optional)</span>
              <input className="input" value={form.company} onChange={set("company")} autoComplete="organization" />
            </label>
          </>
        )}
        <label className="block">
          <span className="label">Email</span>
          <input className="input" type="email" required value={form.email} onChange={set("email")} autoComplete="email" />
        </label>
        <label className="block">
          <span className="label">Password</span>
          <input className="input" type="password" required minLength={mode === "register" ? 8 : 1} value={form.password} onChange={set("password")} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </label>
        {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        {mode === "login" ? (
          <>
            No account?{" "}
            <Link className="font-medium text-accent-strong" href="/register">
              Create one
            </Link>
          </>
        ) : (
          <>
            Already registered?{" "}
            <Link className="font-medium text-accent-strong" href="/login">
              Sign in
            </Link>
          </>
        )}
      </p>
    </main>
  );
}

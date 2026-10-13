"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Check } from "@/lib/calc";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ title, subtitle, actions, children, className, bodyClassName }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cx("card", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <div>
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-muted">{hint}</span>}
    </label>
  );
}

/** Numeric input that lets the user type freely and only commits valid numbers. */
export function NumInput({ value, onChange, step = "any", min, max, suffix, className, disabled }: { value: number; onChange: (v: number) => void; step?: number | "any"; min?: number; max?: number; suffix?: string; className?: string; disabled?: boolean }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className={cx("relative", className)}>
      <input
        type="number"
        inputMode="decimal"
        className={cx("input num", suffix && "pr-12")}
        value={text}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => {
          setText(e.target.value);
          const v = Number(e.target.value);
          if (e.target.value.trim() !== "" && Number.isFinite(v) && (min === undefined || v >= min) && (max === undefined || v <= max)) onChange(v);
        }}
        onBlur={() => setText(String(value))}
      />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">{suffix}</span>}
    </div>
  );
}

export function TextInput({ value, onChange, placeholder, className, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; type?: string }) {
  return <input type={type} className={cx("input", className)} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function Select<T extends string | number>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <select
      className={cx("input", className)}
      value={String(value)}
      onChange={(e) => {
        const opt = options.find((o) => String(o.value) === e.target.value);
        if (opt) onChange(opt.value);
      }}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm select-none">
      <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Stat({ label, value, unit, hint, tone }: { label: ReactNode; value: ReactNode; unit?: string; hint?: ReactNode; tone?: "accent" | "good" | "bad" | "warn" }) {
  return (
    <div className={cx("rounded-xl border border-line bg-surface p-4", tone === "accent" && "border-accent/40 bg-accent-soft/40")}>
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={cx("num text-2xl font-semibold tracking-tight", tone === "good" && "text-good", tone === "bad" && "text-bad", tone === "warn" && "text-warn")}>{value}</span>
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-[11px] leading-snug text-muted">{hint}</div>}
    </div>
  );
}

const STATUS_STYLE = {
  pass: { cls: "bg-good-soft text-good", icon: "✓", label: "Pass" },
  warn: { cls: "bg-warn-soft text-warn", icon: "!", label: "Warning" },
  fail: { cls: "bg-bad-soft text-bad", icon: "✕", label: "Fail" },
  info: { cls: "bg-info-soft text-info", icon: "i", label: "Info" },
} as const;

export function StatusIcon({ status }: { status: Check["status"] }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={cx("inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold", s.cls)} aria-label={s.label} title={s.label}>
      {s.icon}
    </span>
  );
}

export function CheckList({ checks, empty = "No checks for this step yet." }: { checks: Check[]; empty?: string }) {
  if (!checks.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {checks.map((c) => (
        <li key={c.id} className="flex gap-3 py-2.5">
          <StatusIcon status={c.status} />
          <div className="min-w-0">
            <div className="text-sm font-medium">{c.label}</div>
            <div className="text-xs text-muted">{c.detail}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "good" | "warn" | "bad" | "info" }) {
  const t = {
    neutral: "bg-surface-2 text-muted",
    accent: "bg-accent-soft text-accent-strong",
    good: "bg-good-soft text-good",
    warn: "bg-warn-soft text-warn",
    bad: "bg-bad-soft text-bad",
    info: "bg-info-soft text-info",
  }[tone];
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", t)}>{children}</span>;
}

export function ProgressBar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className={cx("h-2 overflow-hidden rounded-full bg-surface-2", className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

/** Formula display block: shows the equation and its substituted values. */
export function Formula({ title, expr, sub, result }: { title?: string; expr: ReactNode; sub?: ReactNode; result?: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-4 py-3">
      {title && <div className="mb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{title}</div>}
      <div className="font-mono text-sm">{expr}</div>
      {sub && <div className="mt-1 font-mono text-xs text-muted">{sub}</div>}
      {result && <div className="mt-1 font-mono text-sm font-semibold text-accent-strong">{result}</div>}
    </div>
  );
}

export function KeyValue({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="divide-y divide-line text-sm">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex items-baseline justify-between gap-4 py-2">
          <dt className="text-muted">{k}</dt>
          <dd className="num text-right font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

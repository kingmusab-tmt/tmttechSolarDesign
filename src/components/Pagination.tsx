"use client";

import { useEffect, useMemo, useState } from "react";
import { cx } from "./ui";

export const PAGE_SIZES = [10, 25, 50] as const;

/** Client-side pagination; jumps back to page 1 whenever `resetKey` (e.g. search + tab) changes. */
export function usePaged<T>(items: T[], resetKey: string, initialSize: number = PAGE_SIZES[0]) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(initialSize);
  useEffect(() => setPage(1), [resetKey, size]);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages);
  const slice = useMemo(() => items.slice((current - 1) * size, current * size), [items, current, size]);
  return { slice, page: current, pages, size, setPage, setSize, total: items.length };
}

function pageList(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const lo = Math.max(2, page - 1);
  const hi = Math.min(pages - 1, page + 1);
  if (lo > 2) out.push("…");
  for (let p = lo; p <= hi; p++) out.push(p);
  if (hi < pages - 1) out.push("…");
  out.push(pages);
  return out;
}

export function Pagination({ page, pages, size, total, setPage, setSize, noun = "items" }: { page: number; pages: number; size: number; total: number; setPage: (p: number) => void; setSize: (s: number) => void; noun?: string }) {
  if (total === 0) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2 text-muted">
        <span className="num">
          {from}–{to} of {total} {noun}
        </span>
        <label className="flex items-center gap-1">
          <span className="sr-only">Per page</span>
          <select className="input w-auto py-1 text-xs" value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Items per page">
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} / page
              </option>
            ))}
          </select>
        </label>
      </div>
      {pages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page">
            ‹
          </button>
          {pageList(page, pages).map((p, i) =>
            p === "…" ? (
              <span key={`e${i}`} className="px-1 text-muted">
                …
              </span>
            ) : (
              <button key={p} className={cx("btn btn-sm min-w-8", p === page && "border-accent bg-accent-soft font-semibold text-accent-strong")} aria-current={p === page ? "page" : undefined} onClick={() => setPage(p)}>
                {p}
              </button>
            ),
          )}
          <button className="btn btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page">
            ›
          </button>
        </nav>
      )}
    </div>
  );
}

/** Case-insensitive match of every search word against the given text fields. */
export function matchesSearch(query: string, ...fields: (string | number | null | undefined)[]) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fields
    .filter((f) => f !== null && f !== undefined)
    .join(" ")
    .toLowerCase();
  return words.every((w) => hay.includes(w));
}

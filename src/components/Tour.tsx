"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { TOURS, tourForPath, type TourId, type TourStep } from "@/lib/tours";

const START_EVENT = "tour:start";
const AUTO_PATHS = (p: string) => p === "/dashboard" || p.startsWith("/projects/");
const CARD_W = 340;
const GAP = 12;
const PAD = 6;

/** Ask the tour host to show the tour for the current page (used by the ? button). */
export function startTour() {
  window.dispatchEvent(new Event(START_EVENT));
}

/** First visible element among the step's data-tour names. */
function findTarget(step: TourStep): HTMLElement | null {
  for (const name of step.target ?? []) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") return el;
    }
  }
  return null;
}

function remember(id: TourId) {
  try {
    localStorage.setItem(`tour:${id}`, "done");
  } catch {
    // storage blocked: the server copy still applies
  }
  fetch("/api/account/tours", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tour: id }) }).catch(() => undefined);
}

function seenLocally(id: TourId) {
  try {
    return localStorage.getItem(`tour:${id}`) === "done";
  } catch {
    return false;
  }
}

type Rect = { top: number; left: number; width: number; height: number };

/** Spotlight tour: dims the page, highlights one element at a time and explains it. */
export function TourHost() {
  const pathname = usePathname();
  const [tour, setTour] = useState<{ id: TourId; steps: TourStep[] } | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [vw, setVw] = useState(1024);
  const [vh, setVh] = useState(768);
  const done = useRef<Set<string> | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const begin = useCallback((id: TourId) => {
    // Keep steps whose element is on this page (e.g. "Share" only shows for the owner).
    const steps = TOURS[id].filter((s) => !s.target || findTarget(s));
    if (steps.length) {
      setIndex(0);
      setTour({ id, steps });
    }
  }, []);

  const finish = useCallback(() => {
    if (tour) {
      remember(tour.id);
      done.current?.add(tour.id);
    }
    setTour(null);
    setRect(null);
  }, [tour]);

  // Start automatically the first time a signed-in user reaches the dashboard or a project.
  useEffect(() => {
    setTour(null);
    if (!AUTO_PATHS(pathname)) return;
    const id = tourForPath(pathname);
    if (seenLocally(id)) return;
    let cancelled = false;
    (async () => {
      if (!done.current) {
        const res = await fetch("/api/account/tours").catch(() => null);
        if (!res?.ok) return;
        done.current = new Set<string>((await res.json()).done ?? []);
      }
      if (cancelled || done.current.has(id)) return;
      setTimeout(() => !cancelled && begin(id), 700); // let the page render its targets
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, begin]);

  // Replay on request.
  useEffect(() => {
    const onStart = () => begin(tourForPath(window.location.pathname));
    window.addEventListener(START_EVENT, onStart);
    return () => window.removeEventListener(START_EVENT, onStart);
  }, [begin]);

  const step = tour?.steps[index];

  // Bring the target into view, then follow it while the page scrolls or resizes.
  useLayoutEffect(() => {
    if (!step) return;
    const el = step.target ? findTarget(step) : null;
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    let frame = 0;
    let last = "";
    const measure = () => {
      const r = el?.getBoundingClientRect();
      const key = r ? `${r.top}|${r.left}|${r.width}|${r.height}|${window.innerWidth}|${window.innerHeight}` : `${window.innerWidth}|${window.innerHeight}`;
      if (key !== last) {
        last = key;
        setVw(window.innerWidth);
        setVh(window.innerHeight);
        setRect(r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null);
      }
      frame = requestAnimationFrame(measure);
    };
    measure();
    nextRef.current?.focus({ preventScroll: true });
    return () => cancelAnimationFrame(frame);
  }, [step]);

  // Keyboard: Esc skips, arrows move.
  useEffect(() => {
    if (!tour) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, tour.steps.length - 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tour, finish]);

  if (!tour || !step) return null;
  const last = index === tour.steps.length - 1;

  // Spotlight box, clamped to the viewport for tall targets.
  const spot = rect
    ? (() => {
        const top = Math.max(GAP, rect.top - PAD);
        const bottom = Math.min(vh - GAP, rect.top + rect.height + PAD);
        return { top, left: Math.max(GAP / 2, rect.left - PAD), width: Math.min(vw - GAP, rect.width + PAD * 2), height: Math.max(0, bottom - top) };
      })()
    : null;

  // Card placement: below or above the target, else docked at the bottom of the screen.
  const w = Math.min(CARD_W, vw - 2 * GAP);
  let cardStyle: React.CSSProperties;
  if (!spot) cardStyle = { top: "50%", left: "50%", width: Math.min(420, vw - 2 * GAP), transform: "translate(-50%, -50%)" };
  else {
    const left = Math.min(Math.max(spot.left + spot.width / 2 - w / 2, GAP), vw - w - GAP);
    if (vh - (spot.top + spot.height) >= 230) cardStyle = { top: spot.top + spot.height + GAP, left, width: w };
    else if (spot.top >= 230) cardStyle = { top: spot.top - GAP, left, width: w, transform: "translateY(-100%)" };
    else cardStyle = { bottom: GAP, left: GAP, right: GAP, maxWidth: 520, marginInline: "auto" };
  }

  return (
    <div className="no-print">
      {/* Blocks clicks on the page while the tour is open. */}
      <div className="fixed inset-0 z-[70]" style={spot ? undefined : { background: "rgba(10, 13, 18, 0.6)" }} aria-hidden="true" />
      {spot && <div className="pointer-events-none fixed z-[71] rounded-xl ring-2 ring-accent" style={{ ...spot, boxShadow: "0 0 0 9999px rgba(10, 13, 18, 0.6)" }} aria-hidden="true" />}
      <div role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body" className="fixed z-[72] rounded-xl border border-line bg-surface p-4 text-sm shadow-2xl" style={cardStyle}>
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 id="tour-title" className="text-base font-semibold">
            {step.title}
          </h2>
          <span className="shrink-0 text-xs text-muted">
            {index + 1} / {tour.steps.length}
          </span>
        </div>
        <p id="tour-body" className="text-muted">
          {step.body}
        </p>
        <div className="mt-3 flex items-center gap-1" aria-hidden="true">
          {tour.steps.map((_, i) => (
            <span key={i} className={i === index ? "h-1.5 w-4 rounded-full bg-accent" : "h-1.5 w-1.5 rounded-full bg-line"} />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" className="text-xs text-muted underline-offset-2 hover:text-text hover:underline" onClick={finish}>
            {last ? "Close" : "Skip tour"}
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <button type="button" className="btn btn-sm" onClick={() => setIndex(index - 1)}>
                Back
              </button>
            )}
            <button ref={nextRef} type="button" className="btn btn-primary btn-sm" onClick={() => (last ? finish() : setIndex(index + 1))}>
              {last ? "Done" : index === 0 ? "Show me around" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** "?" button in the header that replays the tour for the current page. */
export function HelpButton() {
  return (
    <button type="button" data-tour="help" onClick={startTour} aria-label="Show me around (guided tour)" title="Show me around" className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface text-base font-semibold text-muted hover:bg-surface-2 hover:text-text lg:h-9 lg:w-9">
      ?
    </button>
  );
}

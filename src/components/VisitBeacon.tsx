"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Reports each page view for the admin visitor counts. Failures (e.g. offline) are ignored. */
export function VisitBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    fetch("/api/visit", { method: "POST", keepalive: true }).catch(() => undefined);
  }, [pathname]);
  return null;
}

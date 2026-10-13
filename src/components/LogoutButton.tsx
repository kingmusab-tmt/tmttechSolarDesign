"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="btn btn-sm whitespace-nowrap"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        // Drop cached pages so another user of this device can't see them offline.
        if ("caches" in window) for (const k of await caches.keys()) if (k.startsWith("shs-pages")) await caches.delete(k);
        router.push("/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}

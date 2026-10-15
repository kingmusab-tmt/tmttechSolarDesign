import type { Metadata } from "next";
import { LocateClient } from "@/components/location/LocateClient";

export const metadata: Metadata = {
  title: "Share your building's location",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function LocatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <LocateClient token={token} />
    </main>
  );
}

import { NextResponse } from "next/server";

/**
 * Lets the end-to-end scripts confirm they are talking to a server started by
 * scripts/start-test-server.mjs (which forces a local test database), so they can never write
 * test accounts into a real database by accident.
 */
export function GET() {
  return NextResponse.json({ testServer: process.env.E2E_TEST_SERVER === "1" });
}

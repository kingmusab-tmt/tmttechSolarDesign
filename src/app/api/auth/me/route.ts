import { getSession } from "@/lib/server/auth";
import { json } from "@/lib/server/api";

export async function GET() {
  const session = await getSession();
  return session ? json({ user: { id: session.userId, name: session.name, email: session.email } }) : json({ user: null }, 401);
}

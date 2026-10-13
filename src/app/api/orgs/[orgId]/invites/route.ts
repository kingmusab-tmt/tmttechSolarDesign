import { z } from "zod";
import { HttpError, handler, json, readJson } from "@/lib/server/api";
import { loadOrgForRole } from "@/lib/server/orgs";
import { rateLimit } from "@/lib/server/rate-limit";
import { OrgInvite } from "@/models/Organization";
import { User } from "@/models/User";

type Ctx = { params: Promise<{ orgId: string }> };

const Body = z.object({ email: z.email().max(200), role: z.enum(["admin", "member"]).default("member") });

/**
 * Invite someone by email. They see the invitation on the Organisations page after signing in
 * (or after registering with that email) and must accept it before joining.
 */
export const POST = handler<Ctx>(async (req, ctx, session) => {
  const { orgId } = await ctx.params;
  const { org, role: myRole } = await loadOrgForRole(orgId, session.userId, ["owner", "admin"]);
  rateLimit(`invite:${session.userId}`, 30, 60 * 60_000);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, "Enter a valid email address");
  const email = parsed.data.email.toLowerCase();
  if (parsed.data.role === "admin" && myRole !== "owner") throw new HttpError(403, "Only the organisation owner can invite admins");
  const existing = await User.findOne({ email }, { _id: 1 }).lean();
  if (existing && org.members.some((m) => String(m.user) === String(existing._id))) throw new HttpError(409, "That person is already a member");
  if (await OrgInvite.exists({ org: org._id, email, status: "pending" })) throw new HttpError(409, "An invitation is already pending for that email");
  const invite = await OrgInvite.create({ org: org._id, email, role: parsed.data.role, invitedBy: session.userId });
  return json({ invite: { _id: String(invite._id), email, role: invite.role, registered: Boolean(existing) } }, 201);
});

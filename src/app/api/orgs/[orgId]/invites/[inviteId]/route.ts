import { HttpError, assertId, handler, json } from "@/lib/server/api";
import { loadOrgForRole } from "@/lib/server/orgs";
import { OrgInvite } from "@/models/Organization";

type Ctx = { params: Promise<{ orgId: string; inviteId: string }> };

/** Revoke a pending invitation. */
export const DELETE = handler<Ctx>(async (_req, ctx, session) => {
  const { orgId, inviteId } = await ctx.params;
  assertId(inviteId);
  const { org } = await loadOrgForRole(orgId, session.userId, ["owner", "admin"]);
  const res = await OrgInvite.updateOne({ _id: inviteId, org: org._id, status: "pending" }, { $set: { status: "revoked" } });
  if (!res.modifiedCount) throw new HttpError(404, "Invitation not found");
  return json({ ok: true });
});

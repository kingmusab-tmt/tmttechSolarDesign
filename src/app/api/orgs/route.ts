import { z } from "zod";
import { loadUser, myOrgs } from "@/lib/server/access";
import { HttpError, handler, json, readJson } from "@/lib/server/api";
import { viewOrgs } from "@/lib/server/orgs";
import { Organization, OrgInvite, type OrganizationDoc } from "@/models/Organization";

/** My organisations, plus invitations waiting for my email address. */
export const GET = handler(async (_req, _ctx, session) => {
  const me = await loadUser(session);
  const orgs = (await myOrgs(session.userId)) as OrganizationDoc[];
  const pending = await OrgInvite.find({ email: me.email, status: "pending" }).lean();
  const inviteOrgs = await Organization.find({ _id: { $in: pending.map((i) => i.org) } }, { name: 1 }).lean();
  const names = Object.fromEntries(inviteOrgs.map((o) => [String(o._id), o.name]));
  return json({
    orgs: await viewOrgs(orgs, session.userId),
    myInvites: pending
      .filter((i) => names[String(i.org)] && !orgs.some((o) => String(o._id) === String(i.org)))
      .map((i) => ({ _id: String(i._id), orgName: names[String(i.org)], role: i.role, createdAt: new Date(i.createdAt).toISOString() })),
  });
});

const Body = z.object({ name: z.string().trim().min(2, "Organisation name must be at least 2 characters").max(120) });

export const POST = handler(async (req, _ctx, session) => {
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid name");
  const org = await Organization.create({ name: parsed.data.name, createdBy: session.userId, members: [{ user: session.userId, role: "owner" }] });
  return json({ org: { _id: String(org._id), name: org.name } }, 201);
});

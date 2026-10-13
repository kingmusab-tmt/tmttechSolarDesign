import { z } from "zod";
import { sameValue, sectionWriteMode, SECTION_LABELS } from "@/lib/collab";
import { SECTION_KEYS, SECTION_SCHEMAS, normalizeProject, type SectionKey } from "@/lib/schemas";
import { projectAccess } from "@/lib/server/access";
import { HttpError, handler, json, readJson } from "@/lib/server/api";
import { serializeChanges } from "@/lib/server/changes";
import { ChangeRequest, type ChangeRequestDoc } from "@/models/ChangeRequest";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params;
  const access = await projectAccess(session.userId, id);
  const status = new URL(req.url).searchParams.get("status");
  const filter: Record<string, unknown> = { project: access.project._id };
  if (status === "pending") filter.status = "pending";
  const docs = await ChangeRequest.find(filter).sort({ createdAt: -1 }).limit(100).lean<ChangeRequestDoc[]>();
  return json({ changes: await serializeChanges(docs, session.userId) });
});

const Body = z.object({
  section: z.enum(SECTION_KEYS as [SectionKey, ...SectionKey[]]),
  value: z.unknown(),
  comment: z.string().trim().min(3, "Explain your change in a comment (at least 3 characters)").max(2000),
  baseRev: z.number().int().min(0),
});

/** Propose a change to a section another member created. Requires a comment; applied on approval. */
export const POST = handler<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params;
  const access = await projectAccess(session.userId, id);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid proposal");
  const { section, comment, baseRev } = parsed.data;
  const p = access.project;
  const owners = (p.sectionOwners ?? {}) as Record<string, string>;
  if (sectionWriteMode({ shared: access.shared, section, ownerOfSection: owners[section], userId: session.userId }) === "direct") {
    throw new HttpError(400, "You can edit this section directly; no approval is needed");
  }
  const valid = SECTION_SCHEMAS[section].safeParse(parsed.data.value);
  if (!valid.success) throw new HttpError(400, `Invalid ${SECTION_LABELS[section]}: ${valid.error.issues[0]?.message ?? "value"}`);
  const current = (normalizeProject(p as unknown as Record<string, unknown>) as unknown as Record<string, unknown>)[section];
  if (sameValue(current, valid.data)) throw new HttpError(400, "Nothing changed");

  const approvers = [...new Set([owners[section], String(p.owner)])].filter((u) => u && u !== session.userId);
  const doc = await ChangeRequest.create({
    kind: "section",
    project: p._id,
    section,
    org: p.org ?? null,
    proposedBy: session.userId,
    approvers,
    comment,
    value: valid.data,
    baseValue: current,
    baseRev,
  });
  return json({ change: (await serializeChanges([doc.toObject() as unknown as ChangeRequestDoc], session.userId))[0] }, 201);
});

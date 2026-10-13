import { SECTION_KEYS } from "@/lib/schemas";
import { projectAccess } from "@/lib/server/access";
import { handler, json } from "@/lib/server/api";
import { Project } from "@/models/Project";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler<Ctx>(async (_req, ctx, session) => {
  const { id } = await ctx.params;
  // Any member can copy a shared design; the copy is personal to them.
  const src = (await projectAccess(session.userId, id)).project;
  const copy: Record<string, unknown> = { owner: session.userId, name: `${src.name} (copy)`, status: "draft" };
  for (const k of SECTION_KEYS) copy[k] = (src as Record<string, unknown>)[k];
  copy.progress = {};
  const doc = await Project.create(copy);
  return json({ id: String(doc._id) }, 201);
});

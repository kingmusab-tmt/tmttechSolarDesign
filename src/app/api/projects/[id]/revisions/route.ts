import { z } from "zod";
import { computeDesign } from "@/lib/calc";
import { SECTION_KEYS, normalizeProject } from "@/lib/schemas";
import { projectAccess } from "@/lib/server/access";
import { handler, json, readJson } from "@/lib/server/api";
import { Project } from "@/models/Project";
import { Revision, revisionLabel } from "@/models/Revision";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler<Ctx>(async (_req, ctx, session) => {
  const { id } = await ctx.params;
  await projectAccess(session.userId, id); // any member of a shared project can see revisions
  const revs = await Revision.find({ project: id }, { snapshot: 0 }).sort({ number: -1 }).lean();
  return json({
    revisions: revs.map((r) => ({ _id: String(r._id), number: r.number, label: revisionLabel(r.number), note: r.note, summary: r.summary, createdAt: r.createdAt })),
  });
});

const Body = z.object({ note: z.string().trim().max(500).default("") });

export const POST = handler<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params;
  const { note } = Body.parse(await readJson(req).catch(() => ({})));
  const doc = (await projectAccess(session.userId, id)).project;
  const p = normalizeProject(doc as unknown as Record<string, unknown>);
  const r = computeDesign(p);
  const snapshot: Record<string, unknown> = { name: p.name };
  for (const k of SECTION_KEYS) if (k !== "progress") snapshot[k] = p[k];
  const last = await Revision.findOne({ project: id }).sort({ number: -1 }).lean();
  const number = (last?.number ?? 0) + 1;
  const rev = await Revision.create({
    project: id,
    owner: session.userId,
    number,
    note,
    snapshot,
    summary: { arrayKWp: r.strings.arrayW / 1000, inverterKW: r.inverter.ratedPowerW / 1000, batteryKWh: r.battery.bankKWh, dailyKWh: r.load.dailyWh / 1000, capex: r.boq.grandTotal },
  });
  return json({ revision: { _id: String(rev._id), number, label: revisionLabel(number) } }, 201);
});

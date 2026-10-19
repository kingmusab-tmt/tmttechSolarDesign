import { z } from "zod";
import { sampleLoads } from "@/lib/appliances";
import { findState, siteForState } from "@/lib/locations";
import { defaultInputs, normalizeProject } from "@/lib/schemas";
import { HttpError, handler, json, readJson } from "@/lib/server/api";
import { listProjectSummaries } from "@/lib/server/projects";
import { Project } from "@/models/Project";

export const GET = handler(async (_req, _ctx, session) => {
  return json({ projects: await listProjectSummaries(session.userId) });
});

const Body = z.object({
  name: z.string().trim().min(1).max(200),
  clientName: z.string().max(200).optional(),
  state: z.string().max(64).optional(),
  withSample: z.boolean().optional(),
});

export const POST = handler(async (req, _ctx, session) => {
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, "Project name is required");
  const { name, clientName, state, withSample } = parsed.data;
  const d = defaultInputs();
  if (clientName) d.client.name = clientName;
  // The state sets a starting point; the method (NIPOST postcode or city preset) is chosen in Project & Site.
  const st = state ? findState(state) : undefined;
  if (st) d.site = { ...d.site, ...siteForState(st) };
  if (withSample) d.loads = sampleLoads();
  const doc = await Project.create({ ...d, owner: session.userId, name, status: "draft" });
  return json({ project: normalizeProject(doc.toObject() as unknown as Record<string, unknown>) }, 201);
});

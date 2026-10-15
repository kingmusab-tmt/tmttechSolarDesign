import { z } from "zod";
import { sampleLoads } from "@/lib/appliances";
import { findLocation } from "@/lib/locations";
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
  locationPreset: z.string().max(64).optional(),
  withSample: z.boolean().optional(),
});

export const POST = handler(async (req, _ctx, session) => {
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, "Project name is required");
  const { name, clientName, locationPreset, withSample } = parsed.data;
  const d = defaultInputs();
  if (clientName) d.client.name = clientName;
  const loc = locationPreset ? findLocation(locationPreset) : undefined;
  if (loc) d.site = { ...d.site, locationPreset: loc.key, city: loc.city, state: loc.state, latitude: loc.latitude, longitude: loc.longitude, peakSunHours: loc.peakSunHours, tMin: loc.tMin, tMax: loc.tMax };
  // NIPOST: the building is identified and pinned in Project & Site; the default climate stays as a provisional placeholder.
  if (locationPreset === "nipost") d.site = { ...d.site, locationMethod: "nipost", locationPreset: "custom", city: "", state: "" };
  if (withSample) d.loads = sampleLoads();
  const doc = await Project.create({ ...d, owner: session.userId, name, status: "draft" });
  return json({ project: normalizeProject(doc.toObject() as unknown as Record<string, unknown>) }, 201);
});

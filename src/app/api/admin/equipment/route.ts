import { AdminEquipmentBody } from "@/lib/equipment-schema";
import { requireAdmin } from "@/lib/server/access";
import { HttpError, handler, json, readJson } from "@/lib/server/api";
import { ensureSeeded, withNames } from "@/lib/server/equipment";
import { Equipment, type EquipmentDoc } from "@/models/Equipment";

/** Every built-in library item, including retired ones. */
export const GET = handler(async (req, _ctx, session) => {
  await requireAdmin(session);
  await ensureSeeded();
  const type = new URL(req.url).searchParams.get("type");
  const filter: Record<string, unknown> = { owner: null };
  if (type) filter.type = type;
  const items = await Equipment.find(filter).sort({ retired: 1, verified: -1, brand: 1, model: 1 }).lean<EquipmentDoc[]>();
  return json({ items: await withNames(items, session.userId, { admin: true }) });
});

/** Add a new item to the shared library: visible to every user immediately. */
export const POST = handler(async (req, _ctx, session) => {
  await requireAdmin(session);
  const parsed = AdminEquipmentBody.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid equipment");
  if (await Equipment.exists({ owner: null, type: parsed.data.type, brand: parsed.data.brand, model: parsed.data.model, retired: { $ne: true } }))
    throw new HttpError(409, "The library already has an item with that brand and model");
  const doc = await Equipment.create({ ...parsed.data, owner: null, source: "admin" });
  return json({ item: (await withNames([doc.toObject() as EquipmentDoc], session.userId))[0] }, 201);
});

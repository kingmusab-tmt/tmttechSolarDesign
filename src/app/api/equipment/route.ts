import { EquipmentBody } from "@/lib/equipment-schema";
import { HttpError, handler, json, readJson } from "@/lib/server/api";
import { ensureSeeded, visibleEquipmentFilter, withNames } from "@/lib/server/equipment";
import { Equipment, type EquipmentDoc } from "@/models/Equipment";

/** Built-in library + my items + items shared with my organisations. */
export const GET = handler(async (req, _ctx, session) => {
  await ensureSeeded();
  const type = new URL(req.url).searchParams.get("type");
  const filter: Record<string, unknown> = await visibleEquipmentFilter(session.userId);
  if (type) filter.type = type;
  const items = await Equipment.find(filter).sort({ type: 1, owner: -1, verified: -1, brand: 1, model: 1 }).lean<EquipmentDoc[]>();
  return json({ items: await withNames(items, session.userId) });
});

export const POST = handler(async (req, _ctx, session) => {
  const parsed = EquipmentBody.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message.startsWith("Datasheet") ? parsed.error.issues[0].message : "Type and model are required; specs must be numbers");
  const doc = await Equipment.create({ ...parsed.data, owner: session.userId, source: "user" });
  return json({ item: (await withNames([doc.toObject() as EquipmentDoc], session.userId))[0] }, 201);
});

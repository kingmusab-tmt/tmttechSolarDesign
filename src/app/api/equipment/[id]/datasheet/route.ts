import { isValidObjectId } from "mongoose";
import { DATASHEET_MAX_BYTES, DATASHEET_TYPES } from "@/lib/equipment-schema";
import { loadUser } from "@/lib/server/access";
import { HttpError, handler, json } from "@/lib/server/api";
import type { Session } from "@/lib/server/auth";
import { equipmentAccess } from "@/lib/server/equipment";
import { Equipment, type EquipmentDoc } from "@/models/Equipment";
import { EquipmentDatasheet } from "@/models/EquipmentDatasheet";

type Ctx = { params: Promise<{ id: string }> };

/** Owners manage datasheets on their own items; administrators on built-in library items. */
async function writableItem(session: Session, id: string): Promise<EquipmentDoc> {
  if (!isValidObjectId(id)) throw new HttpError(404, "Equipment not found");
  const item = await Equipment.findById(id).lean<EquipmentDoc>();
  if (!item) throw new HttpError(404, "Equipment not found");
  if (item.owner === null) {
    if ((await loadUser(session)).role !== "admin") throw new HttpError(403, "Built-in library items are maintained by administrators");
    return item;
  }
  if (String(item.owner) !== session.userId) throw new HttpError(403, "Only the creator can change this item's datasheet");
  return item;
}

export const POST = handler<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params;
  const item = await writableItem(session, id);
  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    throw new HttpError(400, "Send the datasheet as multipart form data with a 'file' field");
  }
  if (!(file instanceof File)) throw new HttpError(400, "No file received");
  if (!DATASHEET_TYPES.includes(file.type)) throw new HttpError(415, "Datasheets must be PDF, PNG, JPEG or WebP");
  if (file.size > DATASHEET_MAX_BYTES) throw new HttpError(413, "Datasheets are limited to 5 MB");
  const data = Buffer.from(await file.arrayBuffer());
  // Check the content really is what it claims (PDF files start with %PDF).
  if (file.type === "application/pdf" && data.subarray(0, 4).toString() !== "%PDF") throw new HttpError(415, "The file is not a valid PDF");
  const name = file.name.replace(/[^\w.\- ()]+/g, "_").slice(0, 200) || "datasheet";
  const meta = { name, size: data.length, contentType: file.type };
  await EquipmentDatasheet.findOneAndUpdate({ equipment: item._id }, { $set: { ...meta, owner: session.userId, data } }, { upsert: true });
  await Equipment.updateOne({ _id: item._id }, { $set: { datasheetFile: meta, ...(item.owner === null && { adminEdited: true }) } });
  return json({ datasheetFile: meta }, 201);
});

/** Anyone who can see the item (built-in, own, or shared with their organisation) can open its datasheet. */
export const GET = handler<Ctx>(async (_req, ctx, session) => {
  const { id } = await ctx.params;
  const { item } = await equipmentAccess(session.userId, id);
  // Hydrated (not lean) so the bytes come back as a Buffer rather than a BSON Binary.
  const doc = await EquipmentDatasheet.findOne({ equipment: item._id });
  if (!doc) throw new HttpError(404, "No datasheet uploaded for this item");
  const body = new Uint8Array(doc.data); // copy into a plain ArrayBuffer for the Response
  return new Response(body, {
    headers: {
      "Content-Type": doc.contentType,
      "Content-Length": String(doc.size),
      "Content-Disposition": `inline; filename="${doc.name.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

export const DELETE = handler<Ctx>(async (_req, ctx, session) => {
  const { id } = await ctx.params;
  const item = await writableItem(session, id);
  const res = await EquipmentDatasheet.deleteOne({ equipment: item._id });
  if (!res.deletedCount) throw new HttpError(404, "No datasheet uploaded for this item");
  await Equipment.updateOne({ _id: item._id }, { $set: { datasheetFile: null } });
  return json({ ok: true });
});

import "server-only";
import mongoose, { isValidObjectId } from "mongoose";
import { EQUIPMENT_SEED, SEED_VERSION } from "@/lib/equipment-seed";
import { Equipment, toEquipmentItem, type EquipmentDoc } from "@/models/Equipment";
import { Organization } from "@/models/Organization";
import { HttpError } from "./api";
import { myOrgIds, userNames } from "./access";

declare global {
  var _equipmentSeeded: number | undefined;
}

/**
 * Upsert the code-defined built-in library once per server process per seed version.
 * Items an admin has edited or retired are left alone, and admin-created items are never touched.
 */
export async function ensureSeeded() {
  if (globalThis._equipmentSeeded === SEED_VERSION) return;
  await removeStoredDatasheetFiles();
  const keys = EQUIPMENT_SEED.map((e) => e.seedKey);
  await Equipment.deleteMany({
    owner: null,
    adminEdited: { $ne: true },
    source: { $ne: "admin" },
    $or: [{ seedKey: { $exists: false } }, { seedKey: { $nin: keys } }],
  });
  const edited = new Set((await Equipment.find({ seedKey: { $in: keys }, adminEdited: true }, { seedKey: 1 }).lean()).map((e) => e.seedKey));
  const ops = EQUIPMENT_SEED.filter((e) => !edited.has(e.seedKey)).map((e) => ({
    updateOne: { filter: { seedKey: e.seedKey }, update: { $set: { ...e, owner: null, source: "seed", retired: false } }, upsert: true },
  }));
  if (ops.length) await Equipment.bulkWrite(ops);
  globalThis._equipmentSeeded = SEED_VERSION;
}

/** Built-in items, my items, and items shared with my organisations. */
export async function visibleEquipmentFilter(userId: string) {
  const orgIds = await myOrgIds(userId);
  return { retired: { $ne: true }, $or: [{ owner: null }, { owner: userId }, { org: { $in: orgIds } }] };
}

/** `admin`: also name the user each library item was contributed by (not shown to other users). */
export async function withNames(items: EquipmentDoc[], userId: string, opts: { admin?: boolean } = {}) {
  const names = await userNames([...items.map((i) => i.owner), ...(opts.admin ? items.map((i) => i.contributedBy ?? null) : [])]);
  const orgIds = [...new Set(items.map((i) => i.org).filter(Boolean).map(String))];
  const orgs = orgIds.length ? await Organization.find({ _id: { $in: orgIds } }, { name: 1 }).lean() : [];
  const orgNames = Object.fromEntries(orgs.map((o) => [String(o._id), o.name]));
  return items.map((i) => toEquipmentItem(i, { userId, names, orgNames, admin: opts.admin }));
}

/** Identity used to spot the same product in the global library (type + brand + model, case-insensitive). */
export function libraryKey(i: Pick<EquipmentDoc, "type" | "brand" | "model">) {
  const norm = (s: string) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  return `${i.type}|${norm(i.brand)}|${norm(i.model)}`;
}

/** Load an equipment item the user can see, with what they may do with it. */
export async function equipmentAccess(userId: string, id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Equipment not found");
  const item = await Equipment.findOne({ _id: id, ...(await visibleEquipmentFilter(userId)) }).lean<EquipmentDoc>();
  if (!item) throw new HttpError(404, "Equipment not found");
  const mine = item.owner !== null && String(item.owner) === userId;
  return { item, mine, sharedWithMe: !mine && item.owner !== null && Boolean(item.org) };
}

/**
 * Datasheet file uploads were removed (they consumed database storage). Free any space used by
 * files uploaded earlier: drop their collection and the file references. Runs once per process.
 */
async function removeStoredDatasheetFiles() {
  const db = mongoose.connection.db;
  if (!db) return;
  const [coll] = await db.listCollections({ name: "equipmentdatasheets" }).toArray();
  if (coll) await db.dropCollection("equipmentdatasheets");
  await Equipment.collection.updateMany({ datasheetFile: { $exists: true } }, { $unset: { datasheetFile: "" } });
}

import "server-only";
import { isValidObjectId } from "mongoose";
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

export async function withNames(items: EquipmentDoc[], userId: string) {
  const names = await userNames(items.map((i) => i.owner));
  const orgIds = [...new Set(items.map((i) => i.org).filter(Boolean).map(String))];
  const orgs = orgIds.length ? await Organization.find({ _id: { $in: orgIds } }, { name: 1 }).lean() : [];
  const orgNames = Object.fromEntries(orgs.map((o) => [String(o._id), o.name]));
  return items.map((i) => toEquipmentItem(i, { userId, names, orgNames }));
}

/** Load an equipment item the user can see, with what they may do with it. */
export async function equipmentAccess(userId: string, id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Equipment not found");
  const item = await Equipment.findOne({ _id: id, ...(await visibleEquipmentFilter(userId)) }).lean<EquipmentDoc>();
  if (!item) throw new HttpError(404, "Equipment not found");
  const mine = item.owner !== null && String(item.owner) === userId;
  return { item, mine, sharedWithMe: !mine && item.owner !== null && Boolean(item.org) };
}

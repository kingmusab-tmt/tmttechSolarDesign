import { EQUIPMENT_TYPES } from "@/lib/equipment-schema";
import { requireAdmin } from "@/lib/server/access";
import { handler, json } from "@/lib/server/api";
import { ensureSeeded, libraryKey, withNames } from "@/lib/server/equipment";
import { Equipment, type EquipmentDoc } from "@/models/Equipment";
import { User } from "@/models/User";

const STATUS = { pending: { review: { $exists: false } }, added: { "review.status": "added" }, dismissed: { "review.status": "dismissed" } } as const;

/**
 * Equipment users added to their personal libraries, for an administrator to review and add to the
 * global library. Each item says whether the library already has the same brand and model.
 */
export const GET = handler(async (req, _ctx, session) => {
  await requireAdmin(session);
  await ensureSeeded();
  const params = new URL(req.url).searchParams;
  const status = (params.get("status") ?? "pending") as keyof typeof STATUS;
  const type = params.get("type");
  const filter: Record<string, unknown> = { owner: { $ne: null }, ...(STATUS[status] ?? STATUS.pending) };
  if (type && (EQUIPMENT_TYPES as readonly string[]).includes(type)) filter.type = type;

  const [docs, counts] = await Promise.all([
    Equipment.find(filter).sort({ updatedAt: -1 }).limit(2000).lean<EquipmentDoc[]>(),
    Promise.all(Object.entries(STATUS).map(async ([k, f]) => [k, await Equipment.countDocuments({ owner: { $ne: null }, ...f })] as const)),
  ]);
  const library = await Equipment.find({ owner: null, retired: { $ne: true }, type: { $in: [...new Set(docs.map((d) => d.type))] } }, { type: 1, brand: 1, model: 1 }).lean();
  const matches = new Map(library.map((l) => [libraryKey(l), l]));
  const owners = await User.find({ _id: { $in: docs.map((d) => d.owner) } }, { email: 1 }).lean();
  const emails = new Map(owners.map((o) => [String(o._id), o.email]));
  const named = await withNames(docs, session.userId, { admin: true });

  return json({
    counts: Object.fromEntries(counts),
    items: docs.map((d, i) => {
      const match = matches.get(libraryKey(d));
      return {
        ...named[i],
        ownerEmail: emails.get(String(d.owner)) ?? "",
        createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
        updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null,
        review: d.review ? { status: d.review.status, at: d.review.at ? new Date(d.review.at).toISOString() : null, libraryItem: d.review.libraryItem ? String(d.review.libraryItem) : null, comment: d.review.comment ?? "" } : null,
        match: match ? { _id: String(match._id), brand: match.brand, model: match.model } : null,
      };
    }),
  });
});

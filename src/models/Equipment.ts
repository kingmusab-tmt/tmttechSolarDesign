import { Schema, model, models, type Model, Types } from "mongoose";
import { EQUIPMENT_TYPES, type EquipmentItem, type EquipmentType } from "@/lib/equipment-schema";

const EquipmentSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", default: null }, // null = built-in library item
    type: { type: String, enum: EQUIPMENT_TYPES, required: true },
    brand: { type: String, default: "", maxlength: 120 },
    model: { type: String, required: true, maxlength: 200 },
    specs: { type: Schema.Types.Mixed, default: {} },
    datasheetUrl: { type: String, default: "", maxlength: 1000 },
    notes: { type: String, default: "", maxlength: 500 },
    seedKey: { type: String, default: undefined }, // built-in items from the code seed: stable key for upserting
    verified: { type: Boolean, default: false }, // built-in item transcribed from an official datasheet
    source: { type: String, enum: ["seed", "admin", "user"], default: "user" },
    adminEdited: { type: Boolean, default: false }, // seed item changed by an admin: seed updates leave it alone
    retired: { type: Boolean, default: false }, // hidden from users; kept so seed updates cannot resurrect it
    org: { type: Schema.Types.ObjectId, ref: "Organization", default: null }, // shared with this organisation
    // User items: an administrator's decision on adding it to the global library (absent = not reviewed yet).
    review: {
      type: new Schema(
        {
          status: { type: String, enum: ["added", "dismissed"], required: true },
          by: { type: Schema.Types.ObjectId, ref: "User" },
          at: Date,
          libraryItem: { type: Schema.Types.ObjectId, ref: "Equipment", default: null },
          comment: { type: String, default: "", maxlength: 500 },
        },
        { _id: false },
      ),
      default: undefined,
    },
    // Library items: the user whose submission it came from.
    contributedBy: { type: Schema.Types.ObjectId, ref: "User", default: undefined },
  },
  { timestamps: true, minimize: false },
);
EquipmentSchema.index({ type: 1, owner: 1 });
EquipmentSchema.index({ org: 1 });
EquipmentSchema.index({ "review.status": 1, owner: 1 });
EquipmentSchema.index({ seedKey: 1 }, { unique: true, sparse: true });

export interface EquipmentDoc {
  _id: Types.ObjectId;
  owner: Types.ObjectId | null;
  type: EquipmentType;
  brand: string;
  model: string;
  specs: Record<string, unknown>;
  datasheetUrl?: string;
  notes?: string;
  seedKey?: string;
  verified?: boolean;
  source?: "seed" | "admin" | "user";
  adminEdited?: boolean;
  retired?: boolean;
  org?: Types.ObjectId | null;
  review?: { status: "added" | "dismissed"; by?: Types.ObjectId; at?: Date; libraryItem?: Types.ObjectId | null; comment?: string };
  contributedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export const Equipment: Model<EquipmentDoc> = (models.Equipment as Model<EquipmentDoc>) || model<EquipmentDoc>("Equipment", EquipmentSchema);

export function toEquipmentItem(i: EquipmentDoc, ctx: { userId?: string; names?: Record<string, string>; orgNames?: Record<string, string>; admin?: boolean } = {}): EquipmentItem {
  const ownerId = i.owner ? String(i.owner) : "";
  return {
    _id: String(i._id),
    type: i.type,
    brand: i.brand,
    model: i.model,
    specs: i.specs as EquipmentItem["specs"],
    builtIn: i.owner === null,
    datasheetUrl: i.datasheetUrl ?? "",
    notes: i.notes ?? "",
    verified: Boolean(i.verified),
    mine: Boolean(ctx.userId && ownerId === ctx.userId),
    ownerName: ownerId ? (ctx.names?.[ownerId] ?? "") : "",
    orgId: i.org ? String(i.org) : null,
    orgName: i.org ? (ctx.orgNames?.[String(i.org)] ?? "") : "",
    source: i.source ?? (i.owner === null ? "seed" : "user"),
    retired: Boolean(i.retired),
    contributedByName: ctx.admin && i.contributedBy ? (ctx.names?.[String(i.contributedBy)] ?? "") : "",
    libraryStatus: i.owner !== null && ctx.userId && ownerId === ctx.userId ? (i.review?.status ?? null) : null,
  };
}

/** The editable fields, as stored in a change request's base/proposed values. */
export function equipmentEditable(i: Pick<EquipmentDoc, "brand" | "model" | "specs" | "datasheetUrl" | "notes">) {
  return { brand: i.brand, model: i.model, specs: i.specs, datasheetUrl: i.datasheetUrl ?? "", notes: i.notes ?? "" };
}

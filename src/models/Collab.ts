import { Schema, model, models, type Model, Types } from "mongoose";

/**
 * Soft edit lock on one section of a shared project. Expires automatically (TTL index plus an
 * expiresAt check on every read) if the holder stops renewing it, so a lock can never get stuck.
 */
const SectionLockSchema = new Schema({
  project: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  section: { type: String, required: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  userName: { type: String, default: "" },
  step: { type: String, default: "" },
  expiresAt: { type: Date, required: true },
});
SectionLockSchema.index({ project: 1, section: 1 }, { unique: true });
SectionLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export interface SectionLockDoc {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  section: string;
  user: Types.ObjectId;
  userName: string;
  step: string;
  expiresAt: Date;
}

export const SectionLock: Model<SectionLockDoc> = (models.SectionLock as Model<SectionLockDoc>) || model<SectionLockDoc>("SectionLock", SectionLockSchema);

/** Who currently has a shared project open, and on which step. */
const PresenceSchema = new Schema({
  project: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  userName: { type: String, default: "" },
  step: { type: String, default: "" },
  expiresAt: { type: Date, required: true },
});
PresenceSchema.index({ project: 1, user: 1 }, { unique: true });
PresenceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export interface PresenceDoc {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  user: Types.ObjectId;
  userName: string;
  step: string;
  expiresAt: Date;
}

export const Presence: Model<PresenceDoc> = (models.Presence as Model<PresenceDoc>) || model<PresenceDoc>("Presence", PresenceSchema);

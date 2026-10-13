import { Schema, model, models, type Model, Types } from "mongoose";

/**
 * A proposed edit to information created by someone else in a shared organisation:
 * either one section of a shared project, or a shared equipment item. Must carry a comment;
 * applied only when the creator (or the project owner) approves it.
 */
const ChangeRequestSchema = new Schema(
  {
    kind: { type: String, enum: ["section", "equipment"], required: true },
    project: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    section: { type: String, default: null },
    equipment: { type: Schema.Types.ObjectId, ref: "Equipment", default: null },
    org: { type: Schema.Types.ObjectId, ref: "Organization", default: null },
    proposedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** Users allowed to approve: the section/item creator, plus the project owner for sections. */
    approvers: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    comment: { type: String, required: true, maxlength: 2000 },
    value: { type: Schema.Types.Mixed, required: true },
    /** Value and revision at proposal time, to show a diff and detect changes made since. */
    baseValue: { type: Schema.Types.Mixed, default: null },
    baseRev: { type: Number, default: 0 },
    status: { type: String, enum: ["pending", "approved", "rejected", "withdrawn"], default: "pending" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewComment: { type: String, default: "", maxlength: 2000 },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false },
);
ChangeRequestSchema.index({ approvers: 1, status: 1 });
ChangeRequestSchema.index({ project: 1, status: 1 });
ChangeRequestSchema.index({ proposedBy: 1, status: 1 });

export interface ChangeRequestDoc {
  _id: Types.ObjectId;
  kind: "section" | "equipment";
  project: Types.ObjectId | null;
  section: string | null;
  equipment: Types.ObjectId | null;
  org: Types.ObjectId | null;
  proposedBy: Types.ObjectId;
  approvers: Types.ObjectId[];
  comment: string;
  value: unknown;
  baseValue: unknown;
  baseRev: number;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  reviewedBy: Types.ObjectId | null;
  reviewComment: string;
  reviewedAt: Date | null;
  createdAt: Date;
}

export const ChangeRequest: Model<ChangeRequestDoc> = (models.ChangeRequest as Model<ChangeRequestDoc>) || model<ChangeRequestDoc>("ChangeRequest", ChangeRequestSchema);

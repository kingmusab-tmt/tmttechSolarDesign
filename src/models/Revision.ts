import { Schema, model, models, type Model, Types } from "mongoose";

/** An issued, immutable snapshot of a project's design inputs (Rev A, Rev B, …). */
const RevisionSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    number: { type: Number, required: true },
    note: { type: String, default: "", maxlength: 500 },
    snapshot: { type: Schema.Types.Mixed, required: true },
    summary: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false },
);
RevisionSchema.index({ project: 1, number: -1 }, { unique: true });

export interface RevisionDoc {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  owner: Types.ObjectId;
  number: number;
  note: string;
  snapshot: Record<string, unknown>;
  summary: Record<string, number>;
  createdAt: Date;
}

export const Revision: Model<RevisionDoc> = (models.Revision as Model<RevisionDoc>) || model<RevisionDoc>("Revision", RevisionSchema);

export { revisionLabel } from "@/lib/revision-label";

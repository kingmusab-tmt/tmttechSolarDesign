import { Schema, model, models, type Model, Types } from "mongoose";
import { PROJECT_STATUSES } from "@/lib/schemas";

/**
 * Section contents are validated by the Zod schemas in lib/schemas.ts before every write,
 * so they are stored as Mixed here.
 */
const Mixed = Schema.Types.Mixed;

const ProjectSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    status: { type: String, enum: PROJECT_STATUSES, default: "draft" },
    client: { type: Mixed, default: {} },
    site: { type: Mixed, default: {} },
    loads: { type: Mixed, default: [] },
    inverter: { type: Mixed, default: {} },
    battery: { type: Mixed, default: {} },
    pv: { type: Mixed, default: {} },
    strings: { type: Mixed, default: {} },
    controller: { type: Mixed, default: {} },
    cables: { type: Mixed, default: {} },
    assessment: { type: Mixed, default: {} },
    layout: { type: Mixed, default: {} },
    compliance: { type: Mixed, default: {} },
    boq: { type: Mixed, default: {} },
    handover: { type: Mixed, default: {} },
    financial: { type: Mixed, default: {} },
    progress: { type: Mixed, default: {} },
    /** Shared with this organisation (null = personal project). */
    org: { type: Schema.Types.ObjectId, ref: "Organization", default: null, index: true },
    /** section → user id of whoever first entered information in it (shared projects). */
    sectionOwners: { type: Mixed, default: {} },
    /** section → revision counter, incremented on every write (optimistic concurrency). */
    sectionRev: { type: Mixed, default: {} },
    /** section → { user, name, at } of the latest write. */
    sectionEditedBy: { type: Mixed, default: {} },
  },
  { timestamps: true, minimize: false },
);
ProjectSchema.index({ owner: 1, updatedAt: -1 });

export interface ProjectDoc {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  org?: Types.ObjectId | null;
  sectionOwners?: Record<string, string>;
  sectionRev?: Record<string, number>;
  sectionEditedBy?: Record<string, { user: string; name: string; at: string }>;
  name: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  [section: string]: unknown;
}

export const Project: Model<ProjectDoc> = (models.Project as Model<ProjectDoc>) || model<ProjectDoc>("Project", ProjectSchema);

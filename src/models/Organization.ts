import { Schema, model, models, type Model, Types } from "mongoose";

export const ORG_ROLES = ["owner", "admin", "member"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

const MemberSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ORG_ROLES, default: "member" },
    joinedAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const OrganizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: { type: [MemberSchema], default: [] },
  },
  { timestamps: true },
);
OrganizationSchema.index({ "members.user": 1 });

export interface OrganizationDoc {
  _id: Types.ObjectId;
  name: string;
  createdBy: Types.ObjectId;
  members: { user: Types.ObjectId; role: OrgRole; joinedAt: Date }[];
  createdAt: Date;
}

export const Organization: Model<OrganizationDoc> = (models.Organization as Model<OrganizationDoc>) || model<OrganizationDoc>("Organization", OrganizationSchema);

const OrgInviteSchema = new Schema(
  {
    org: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ["admin", "member"], default: "member" },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "accepted", "declined", "revoked"], default: "pending" },
  },
  { timestamps: true },
);
OrgInviteSchema.index({ email: 1, status: 1 });
OrgInviteSchema.index({ org: 1, email: 1, status: 1 });

export interface OrgInviteDoc {
  _id: Types.ObjectId;
  org: Types.ObjectId;
  email: string;
  role: "admin" | "member";
  invitedBy: Types.ObjectId;
  status: "pending" | "accepted" | "declined" | "revoked";
  createdAt: Date;
}

export const OrgInvite: Model<OrgInviteDoc> = (models.OrgInvite as Model<OrgInviteDoc>) || model<OrgInviteDoc>("OrgInvite", OrgInviteSchema);

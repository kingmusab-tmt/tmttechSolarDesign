import { Schema, model, models, type Model, Types } from "mongoose";

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 200 },
    passwordHash: { type: String, required: true },
    company: { type: String, default: "", maxlength: 200 },
    /** "admin" can maintain the shared equipment library and manage users. */
    role: { type: String, enum: USER_ROLES, default: "user" },
    /** Guided tours finished or skipped (see lib/tours.ts). */
    toursDone: { type: [String], default: [] },
  },
  { timestamps: true },
);

export interface UserDoc {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  company: string;
  role: UserRole;
  toursDone?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export const User: Model<UserDoc> = (models.User as Model<UserDoc>) || model<UserDoc>("User", UserSchema);

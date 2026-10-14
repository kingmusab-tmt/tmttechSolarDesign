import { Schema, model, models, type Model, Types } from "mongoose";

/** Keep about 13 months so year-on-year totals work; MongoDB deletes older rows automatically. */
export const VISIT_RETENTION_DAYS = 400;

/**
 * One row per device per UTC day: enough to count unique visitors, signed-in users and page views
 * without storing IP addresses or the pages visited. The visitor id is a random value in a cookie.
 */
const VisitSchema = new Schema(
  {
    day: { type: String, required: true }, // "YYYY-MM-DD" (UTC)
    visitor: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", default: null }, // set once the visitor is signed in
    views: { type: Number, default: 0 },
    lastAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);
VisitSchema.index({ day: 1, visitor: 1 }, { unique: true });
VisitSchema.index({ user: 1, lastAt: -1 });
VisitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export interface VisitDoc {
  _id: Types.ObjectId;
  day: string;
  visitor: string;
  user: Types.ObjectId | null;
  views: number;
  lastAt: Date;
  expiresAt: Date;
}

export const Visit: Model<VisitDoc> = (models.Visit as Model<VisitDoc>) || model<VisitDoc>("Visit", VisitSchema);

export function utcDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

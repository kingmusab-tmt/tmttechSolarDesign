import { Schema, model, models, type Model, Types } from "mongoose";

/** Links expire after a week; MongoDB deletes expired requests automatically. */
export const LOCATION_REQUEST_DAYS = 7;

/**
 * A link the engineer sends to a client so the client can share their building's location from
 * their own phone (GPS or map pin, optionally with their NIPOST postcode). Only a SHA-256 hash of the
 * link token is stored. The answer is held here until the engineer reviews and applies it: the
 * client never writes to the project itself.
 */
const LocationRequestSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "submitted", "closed"], default: "pending" },
    result: {
      type: new Schema(
        {
          lat: Number,
          lng: Number,
          accuracyM: { type: Number, default: 0 },
          source: { type: String, enum: ["gps", "map"], default: "map" },
          postcode: { type: String, default: "" },
          note: { type: String, default: "" },
          pinChecked: { type: Boolean, default: false },
          pinPostcode: { type: String, default: "" },
          pinDistanceM: { type: Number, default: 0 },
          pinConfidence: { type: String, default: "" },
          submittedAt: Date,
        },
        { _id: false },
      ),
      default: null,
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false },
);
LocationRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export interface LocationResult {
  lat: number;
  lng: number;
  accuracyM: number;
  source: "gps" | "map";
  postcode: string;
  note: string;
  pinChecked: boolean;
  pinPostcode: string;
  pinDistanceM: number;
  pinConfidence: string;
  submittedAt: Date;
}

export interface LocationRequestDoc {
  _id: Types.ObjectId;
  tokenHash: string;
  project: Types.ObjectId;
  createdBy: Types.ObjectId;
  status: "pending" | "submitted" | "closed";
  result: LocationResult | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const LocationRequest: Model<LocationRequestDoc> = (models.LocationRequest as Model<LocationRequestDoc>) || model<LocationRequestDoc>("LocationRequest", LocationRequestSchema);

import { Schema, model, models, type Model, Types } from "mongoose";

/** Uploaded datasheet bytes (≤ 5 MB), kept apart from Equipment so library listings stay light. */
const EquipmentDatasheetSchema = new Schema(
  {
    equipment: { type: Schema.Types.ObjectId, ref: "Equipment", required: true, unique: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, maxlength: 200 },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true },
);

export interface EquipmentDatasheetDoc {
  _id: Types.ObjectId;
  equipment: Types.ObjectId;
  owner: Types.ObjectId;
  name: string;
  contentType: string;
  size: number;
  data: Buffer;
}

export const EquipmentDatasheet: Model<EquipmentDatasheetDoc> = (models.EquipmentDatasheet as Model<EquipmentDatasheetDoc>) || model<EquipmentDatasheetDoc>("EquipmentDatasheet", EquipmentDatasheetSchema);

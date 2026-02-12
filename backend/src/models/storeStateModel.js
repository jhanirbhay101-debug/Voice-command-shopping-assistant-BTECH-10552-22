import mongoose from "mongoose";

const { Schema } = mongoose;

const ListSch = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    brand: { type: String, default: "Generic" },
    quantity: { type: Number, default: 1 },
    unit: { type: String, default: "unit" },
    size: { type: String, default: "" },
    category: { type: String, default: "others" },
    inStock: { type: Boolean, default: true },
    lastKnownPrice: { type: Number, default: null },
    lineTotalPrice: { type: Number, default: null },
    billableQuantity: { type: Number, default: null },
    billableUnit: { type: String, default: "" },
    pricingMode: { type: String, default: "unknown" },
    addedAt: { type: String, required: true },
    lastUpdatedAt: { type: String, required: true }
  },
  { _id: false }
);

const HistSch = new Schema(
  {
    name: { type: String, required: true },
    brand: { type: String, default: "Generic" },
    quantity: { type: Number, default: 1 },
    unit: { type: String, default: "unit" },
    action: { type: String, default: "add" },
    timestamp: { type: String, required: true }
  },
  { _id: false }
);

const StoreSch = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    list: { type: [ListSch], default: [] },
    history: { type: [HistSch], default: [] },
    preferences: { type: Schema.Types.Mixed, default: {} }
  },
  {
    timestamps: true
  }
);

export const StoreState = mongoose.model("StoreState", StoreSch);


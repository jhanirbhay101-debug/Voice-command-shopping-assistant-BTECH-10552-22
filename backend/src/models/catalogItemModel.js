import mongoose from "mongoose";

const { Schema } = mongoose;

const CatItemSch = new Schema(
  {
    sku: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, index: true },
    brand: { type: String, required: true, index: true },
    size: { type: String, default: "" },
    price: { type: Number, required: true },
    salePrice: { type: Number, default: null },
    onSale: { type: Boolean, default: false },
    category: { type: String, required: true, index: true },
    inStock: { type: Boolean, default: true, index: true },
    seasonMonths: { type: [Number], default: [] },
    substitutes: { type: [String], default: [] }
  },
  {
    timestamps: true
  }
);

export const CatalogItem = mongoose.model("CatalogItem", CatItemSch);


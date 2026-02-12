import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { CatalogItem } from "../src/models/catalogItemModel.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isPos = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

const normItem = (entry) => ({
  sku: String(entry.sku || "").trim(),
  name: String(entry.name || "").trim().toLowerCase(),
  brand: String(entry.brand || "").trim(),
  size: String(entry.size || "").trim(),
  price: Number(entry.price),
  salePrice:
    entry.salePrice === null || typeof entry.salePrice === "undefined" || entry.salePrice === ""
      ? null
      : Number(entry.salePrice),
  onSale: Boolean(entry.onSale),
  category: String(entry.category || "").trim(),
  inStock: typeof entry.inStock === "boolean" ? entry.inStock : true,
  seasonMonths: Array.isArray(entry.seasonMonths)
    ? entry.seasonMonths.map((month) => Number(month)).filter((month) => month >= 1 && month <= 12)
    : [],
  substitutes: Array.isArray(entry.substitutes)
    ? entry.substitutes.map((value) => String(value).trim().toLowerCase()).filter(Boolean)
    : []
});

const checkItem = (entry) => {
  if (!entry.sku) return "Missing sku";
  if (!entry.name) return "Missing name";
  if (!entry.brand) return "Missing brand";
  if (!entry.category) return "Missing category";
  if (!isPos(entry.price)) return "Invalid price";
  if (entry.onSale && !isPos(entry.salePrice)) return "Invalid salePrice for on-sale item";
  return null;
};

const readJson = async (sourceArg) => {
  const sourcePath = path.isAbsolute(sourceArg)
    ? sourceArg
    : path.resolve(__dirname, "..", sourceArg);

  const raw = await fs.readFile(sourcePath, "utf-8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("Catalog JSON must be an array");
  }

  const seenSku = new Set();
  const valid = [];
  const invalid = [];

  parsed.forEach((rawEntry, index) => {
    const item = normItem(rawEntry);
    const validationError = checkItem(item);

    if (validationError) {
      invalid.push({ index, sku: item.sku || "n/a", reason: validationError });
      return;
    }

    if (seenSku.has(item.sku)) {
      invalid.push({ index, sku: item.sku, reason: "Duplicate sku" });
      return;
    }

    seenSku.add(item.sku);
    valid.push(item);
  });

  return {
    sourcePath,
    valid,
    invalid
  };
};

const run = async () => {
  const mongoUri = process.env.MONGODB_URI;
  const mongoDbName = process.env.MONGODB_DB_NAME || "voice-shopping";

  if (!mongoUri) {
    throw new Error("MONGODB_URI is missing. Add it to backend/.env before import.");
  }

  const jsonArg = process.argv[2] || "src/data/catalog.large.json";
  const { sourcePath, valid, invalid } = await readJson(jsonArg);

  if (!valid.length) {
    throw new Error("No valid catalog items found in the JSON file.");
  }

  await mongoose.connect(mongoUri, { dbName: mongoDbName });

  try {
    const deleteResult = await CatalogItem.deleteMany({});
    const inserted = await CatalogItem.insertMany(valid, { ordered: false });

    console.log(`Source file: ${sourcePath}`);
    console.log(`Database: ${mongoDbName}`);
    console.log(`Deleted existing documents: ${deleteResult.deletedCount}`);
    console.log(`Inserted documents: ${inserted.length}`);

    if (invalid.length) {
      console.log(`Skipped invalid records: ${invalid.length}`);
      console.log("First 10 invalid records:", invalid.slice(0, 10));
    }
  } finally {
    await mongoose.disconnect();
  }
};

await run();



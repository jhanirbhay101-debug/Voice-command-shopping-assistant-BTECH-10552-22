import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { catKeys } from "../data/catalog.js";
import { StoreState } from "../models/storeStateModel.js";
import { isMongoConnected } from "../config/database.js";
import { findBestCatalogMatch, normalizeText } from "./catalogService.js";
import {
  computePricingSnapshot,
  convertQuantity,
  mergeQuantities,
  toCanonicalUnit
} from "./pricingService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storePath = path.join(__dirname, "../data/store.json");

const toQty = (value, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const pickCat = (itemName) => {
  const key = normalizeText(itemName);
  for (const [category, words] of Object.entries(catKeys)) {
    if (words.some((word) => key.includes(word))) {
      return category;
    }
  }
  return "others";
};

const normHist = (entry) => {
  if (typeof entry === "string") {
    return {
      name: normalizeText(entry),
      brand: "Generic",
      quantity: 1,
      unit: "unit",
      action: "add",
      timestamp: new Date().toISOString()
    };
  }

  return {
    name: normalizeText(entry.name || ""),
    brand: entry.brand || "Generic",
    quantity: toQty(entry.quantity),
    unit: entry.unit || "unit",
    action: entry.action || "add",
    timestamp: entry.timestamp || new Date().toISOString()
  };
};

const applyPrice = (entry, unitPriceOverride = null) => {
  if (Number.isFinite(Number(unitPriceOverride)) && Number(unitPriceOverride) > 0) {
    entry.lastKnownPrice = Number(unitPriceOverride);
  }

  const pricing = computePricingSnapshot({
    quantity: entry.quantity,
    unit: entry.unit,
    size: entry.size,
    unitPrice: entry.lastKnownPrice
  });

  entry.lineTotalPrice = pricing.lineTotalPrice;
  entry.billableQuantity = pricing.billableQuantity;
  entry.billableUnit = pricing.billableUnit;
  entry.pricingMode = pricing.pricingMode;

  return entry;
};

const normList = (entry) => {
  const normalized = {
    id: entry.id || uuidv4(),
    name: normalizeText(entry.name || ""),
    brand: entry.brand || "Generic",
    quantity: toQty(entry.quantity),
    unit: toCanonicalUnit(entry.unit || "unit"),
    size: entry.size || "",
    category: entry.category || pickCat(entry.name || ""),
    inStock: typeof entry.inStock === "boolean" ? entry.inStock : true,
    lastKnownPrice: Number.isFinite(Number(entry.lastKnownPrice))
      ? Number(entry.lastKnownPrice)
      : null,
    lineTotalPrice: Number.isFinite(Number(entry.lineTotalPrice))
      ? Number(entry.lineTotalPrice)
      : null,
    billableQuantity: Number.isFinite(Number(entry.billableQuantity))
      ? Number(entry.billableQuantity)
      : null,
    billableUnit: entry.billableUnit || "",
    pricingMode: entry.pricingMode || "unknown",
    addedAt: entry.addedAt || new Date().toISOString(),
    lastUpdatedAt: entry.lastUpdatedAt || new Date().toISOString()
  };

  return applyPrice(normalized);
};

const shapeStore = (store = {}) => {
  return {
    list: Array.isArray(store.list) ? store.list.map(normList) : [],
    history: Array.isArray(store.history) ? store.history.map(normHist) : [],
    preferences:
      store.preferences && typeof store.preferences === "object" ? store.preferences : {}
  };
};

const readJson = async () => {
  try {
    const raw = await fs.readFile(storePath, "utf-8");
    return shapeStore(JSON.parse(raw));
  } catch (error) {
    if (error.code === "ENOENT") {
      return shapeStore({});
    }
    throw error;
  }
};

const writeJson = async (data) => {
  await fs.writeFile(storePath, JSON.stringify(data, null, 2), "utf-8");
};

const readMongo = async () => {
  let doc = await StoreState.findOne({ key: "default" }).lean();

  if (!doc) {
    const seeded = await readJson();
    await StoreState.create({
      key: "default",
      list: seeded.list,
      history: seeded.history,
      preferences: seeded.preferences
    });

    doc = {
      key: "default",
      list: seeded.list,
      history: seeded.history,
      preferences: seeded.preferences
    };
  }

  return shapeStore(doc);
};

const writeMongo = async (data) => {
  await StoreState.updateOne(
    { key: "default" },
    {
      $set: {
        list: data.list,
        history: data.history,
        preferences: data.preferences
      }
    },
    { upsert: true }
  );
};

const readDb = async () => {
  if (isMongoConnected()) {
    return readMongo();
  }
  return readJson();
};

const writeDb = async (data) => {
  if (isMongoConnected()) {
    await writeMongo(data);
    // Keep local JSON snapshot updated for offline fallback/debugging.
    await writeJson(data);
    return;
  }

  await writeJson(data);
};

const resolveItem = ({ name, brand = "", size = "", unit = "unit", quantity = 1 }) => {
  const normalizedName = normalizeText(name);
  const match = findBestCatalogMatch({ name: normalizedName, brand, size });
  const effectivePrice =
    typeof match?.salePrice === "number" && match.onSale
      ? match.salePrice
      : typeof match?.price === "number"
        ? match.price
        : null;

  const finalUnit = toCanonicalUnit(unit || "unit");
  const finalSize = size || match?.size || "";
  const pricing = computePricingSnapshot({
    quantity: toQty(quantity),
    unit: finalUnit,
    size: finalSize,
    unitPrice: effectivePrice
  });

  return {
    name: match?.name || normalizedName,
    brand: match?.brand || brand || "Generic",
    size: finalSize,
    unit: finalUnit,
    category: match?.category || pickCat(normalizedName),
    inStock: typeof match?.inStock === "boolean" ? match.inStock : true,
    lastKnownPrice: effectivePrice,
    lineTotalPrice: pricing.lineTotalPrice,
    billableQuantity: pricing.billableQuantity,
    billableUnit: pricing.billableUnit,
    pricingMode: pricing.pricingMode
  };
};

const nameMatch = (candidateName, inputName) => {
  const c = normalizeText(candidateName);
  const i = normalizeText(inputName);
  return c === i || c.includes(i) || i.includes(c);
};

const pushHist = (store, { name, brand, quantity, unit, action }) => {
  store.history.push({
    name: normalizeText(name),
    brand: brand || "Generic",
    quantity: toQty(quantity),
    unit: unit || "unit",
    action,
    timestamp: new Date().toISOString()
  });
};

export const listItems = async () => {
  const store = await readDb();
  return store.list.sort((a, b) => a.name.localeCompare(b.name));
};

export const addItem = async ({
  name,
  brand = "",
  quantity = 1,
  unit = "unit",
  size = "",
  mode = "increment"
}) => {
  const store = await readDb();
  const qty = toQty(quantity);
  const details = resolveItem({ name, brand, size, unit, quantity: qty });

  const existing = store.list.find(
    (item) =>
      normalizeText(item.name) === normalizeText(details.name) &&
      normalizeText(item.brand) === normalizeText(details.brand)
  );

  if (existing) {
    if (mode === "set") {
      existing.quantity = qty;
      existing.unit = details.unit;
    } else {
      const merged = mergeQuantities({
        currentQuantity: existing.quantity,
        currentUnit: existing.unit,
        deltaQuantity: qty,
        deltaUnit: details.unit
      });
      existing.quantity = toQty(merged.quantity);
      existing.unit = toCanonicalUnit(merged.unit || details.unit || existing.unit);
    }

    existing.size = details.size || existing.size;
    existing.category = details.category;
    existing.inStock = details.inStock;
    if (Number.isFinite(Number(details.lastKnownPrice)) && Number(details.lastKnownPrice) > 0) {
      existing.lastKnownPrice = Number(details.lastKnownPrice);
    }
    applyPrice(existing);
    existing.lastUpdatedAt = new Date().toISOString();
  } else {
    const nextItem = {
      id: uuidv4(),
      name: details.name,
      brand: details.brand,
      quantity: qty,
      unit: details.unit,
      size: details.size,
      category: details.category,
      inStock: details.inStock,
      lastKnownPrice: details.lastKnownPrice,
      lineTotalPrice: details.lineTotalPrice,
      billableQuantity: details.billableQuantity,
      billableUnit: details.billableUnit,
      pricingMode: details.pricingMode,
      addedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString()
    };

    store.list.push(applyPrice(nextItem));
  }

  pushHist(store, {
    name: details.name,
    brand: details.brand,
    quantity: qty,
    unit: details.unit,
    action: mode === "set" ? "update" : "add"
  });

  await writeDb(store);
  return store.list;
};

export const removeItemByName = async ({ name, brand = "", quantity = null, unit = "unit" }) => {
  const store = await readDb();
  const qty = quantity === null ? null : toQty(quantity, 0);

  const targetIndex = store.list.findIndex((item) => {
    const brandMatch = !brand || normalizeText(item.brand).includes(normalizeText(brand));
    return brandMatch && nameMatch(item.name, name);
  });

  if (targetIndex === -1) {
    return {
      removed: false,
      list: store.list
    };
  }

  const target = store.list[targetIndex];
  const removalQty =
    qty === null
      ? null
      : convertQuantity(qty, unit, target.unit) ?? qty;

  if (removalQty && target.quantity > removalQty) {
    target.quantity -= removalQty;
    applyPrice(target);
    target.lastUpdatedAt = new Date().toISOString();
    pushHist(store, {
      name: target.name,
      brand: target.brand,
      quantity: removalQty,
      unit: target.unit || "unit",
      action: "decrement"
    });
  } else {
    store.list.splice(targetIndex, 1);
    pushHist(store, {
      name: target.name,
      brand: target.brand,
      quantity: target.quantity,
      unit: target.unit,
      action: "remove"
    });
  }

  await writeDb(store);
  return {
    removed: true,
    list: store.list
  };
};

export const setItemQuantityByName = async ({ name, brand = "", quantity, unit = "unit", size = "" }) => {
  const store = await readDb();
  const qty = toQty(quantity);
  const details = resolveItem({ name, brand, size, unit, quantity: qty });

  const existing = store.list.find(
    (item) =>
      nameMatch(item.name, details.name) &&
      (!brand || normalizeText(item.brand).includes(normalizeText(brand)))
  );

  if (existing) {
    existing.name = details.name;
    existing.brand = details.brand;
    existing.quantity = qty;
    existing.unit = details.unit;
    existing.size = details.size || existing.size;
    existing.category = details.category;
    existing.inStock = details.inStock;
    if (Number.isFinite(Number(details.lastKnownPrice)) && Number(details.lastKnownPrice) > 0) {
      existing.lastKnownPrice = Number(details.lastKnownPrice);
    }
    applyPrice(existing);
    existing.lastUpdatedAt = new Date().toISOString();

    pushHist(store, {
      name: existing.name,
      brand: existing.brand,
      quantity: qty,
      unit: existing.unit,
      action: "update"
    });

    await writeDb(store);
    return { created: false, item: existing, list: store.list };
  }

  const list = await addItem({
    name: details.name,
    brand: details.brand,
    quantity: qty,
    unit: details.unit,
    size: details.size,
    mode: "set"
  });

  const item = list.find(
    (entry) =>
      normalizeText(entry.name) === normalizeText(details.name) &&
      normalizeText(entry.brand) === normalizeText(details.brand)
  );

  return { created: true, item, list };
};

export const updateItem = async (id, updates) => {
  const store = await readDb();
  const item = store.list.find((entry) => entry.id === id);

  if (!item) {
    return null;
  }

  if (updates.name) {
    item.name = normalizeText(updates.name);
    item.category = pickCat(item.name);
  }
  if (updates.brand) {
    item.brand = updates.brand;
  }
  if (typeof updates.quantity !== "undefined") {
    item.quantity = toQty(updates.quantity);
  }
  if (updates.unit) {
    item.unit = toCanonicalUnit(updates.unit);
  }
  if (typeof updates.size !== "undefined") {
    item.size = updates.size;
  }

  if (typeof updates.lastKnownPrice !== "undefined") {
    item.lastKnownPrice = Number.isFinite(Number(updates.lastKnownPrice))
      ? Number(updates.lastKnownPrice)
      : item.lastKnownPrice;
  }

  applyPrice(item);

  item.lastUpdatedAt = new Date().toISOString();

  pushHist(store, {
    name: item.name,
    brand: item.brand,
    quantity: item.quantity,
    unit: item.unit,
    action: "update"
  });

  await writeDb(store);
  return item;
};

export const removeItemById = async (id) => {
  const store = await readDb();
  const target = store.list.find((item) => item.id === id);
  const oldLen = store.list.length;
  store.list = store.list.filter((item) => item.id !== id);

  if (target) {
    pushHist(store, {
      name: target.name,
      brand: target.brand,
      quantity: target.quantity,
      unit: target.unit,
      action: "remove"
    });
  }

  await writeDb(store);
  return oldLen !== store.list.length;
};

export const getHistoryAndPreferences = async () => {
  const store = await readDb();
  return {
    history: store.history,
    preferences: store.preferences
  };
};



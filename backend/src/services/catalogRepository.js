import { catalog as fallbackCatalog } from "../data/catalog.js";
import { isMongoConnected } from "../config/database.js";
import { CatalogItem } from "../models/catalogItemModel.js";

let catCache = [...fallbackCatalog];
let catSrc = "json";

const toRow = (doc) => ({
  sku: doc.sku,
  name: doc.name,
  brand: doc.brand,
  size: doc.size || "",
  price: Number(doc.price),
  salePrice: doc.salePrice ?? null,
  onSale: Boolean(doc.onSale),
  category: doc.category,
  inStock: Boolean(doc.inStock),
  seasonMonths: Array.isArray(doc.seasonMonths) ? doc.seasonMonths : [],
  substitutes: Array.isArray(doc.substitutes) ? doc.substitutes : []
});

export const refreshCatalogCache = async () => {
  if (!isMongoConnected()) {
    catCache = [...fallbackCatalog];
    catSrc = "json";
    return { source: catSrc, count: catCache.length };
  }

  try {
    const docs = await CatalogItem.find({}).lean();

    if (!docs.length) {
      catCache = [...fallbackCatalog];
      catSrc = "json";
      return { source: catSrc, count: catCache.length };
    }

    catCache = docs.map(toRow);
    catSrc = "mongodb";
    return { source: catSrc, count: catCache.length };
  } catch {
    catCache = [...fallbackCatalog];
    catSrc = "json";
    return { source: catSrc, count: catCache.length };
  }
};

export const getCatalogSnapshot = () => catCache;

export const getCatalogSource = () => catSrc;


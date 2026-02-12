import { v4 as uuidv4 } from "uuid";
import { filterCatalog, normalizeText } from "./catalogService.js";
import { computePricingSnapshot } from "./pricingService.js";

const BRAND_SELECTION_TTL_MS = 10 * 60 * 1000;
const MAX_OPTIONS = 10;
const pendingBrandPicks = new Map();

const effPrice = (entry) =>
  entry.onSale && typeof entry.salePrice === "number" ? entry.salePrice : entry.price;

const cleanExpired = () => {
  const now = Date.now();
  for (const [token, payload] of pendingBrandPicks.entries()) {
    if (payload.expiresAtMs <= now) {
      pendingBrandPicks.delete(token);
    }
  }
};

const scoreOpt = (option, query, size) => {
  const q = normalizeText(query);
  const s = normalizeText(size);
  const n = normalizeText(option.name);
  const b = normalizeText(option.brand);
  const sz = normalizeText(option.size || "");

  let score = 0;
  if (n === q) score += 6;
  if (n.includes(q)) score += 3;
  if (q.includes(n)) score += 2;
  if (s && sz.includes(s)) score += 2;
  if (option.inStock) score += 1;

  // Stable fallback for deterministic ordering.
  score += Math.max(0, 1 - b.length / 1000);
  return score;
};

const fmtPrice = (entry) => {
  const price = effPrice(entry);
  if (entry.onSale && typeof entry.salePrice === "number") {
    return `$${price.toFixed(2)} (sale, was $${entry.price.toFixed(2)})`;
  }
  return `$${price.toFixed(2)}`;
};

const fmtMoney = (value) => `$${Number(value).toFixed(2)}`;

export const buildBrandSelectionProposal = ({
  item,
  brand = "",
  size = "",
  quantity = 1,
  unit = "unit",
  action = "add"
}) => {
  if (!item || brand) {
    return null;
  }

  const opts = filterCatalog({
    query: item,
    size,
    inStockOnly: true
  })
    .map((entry) => {
      const pricePerSku = effPrice(entry);
      const pricing = computePricingSnapshot({
        quantity,
        unit,
        size: entry.size || "",
        unitPrice: pricePerSku
      });

      return {
        sku: entry.sku,
        name: entry.name,
        brand: entry.brand,
        size: entry.size || "",
        category: entry.category,
        inStock: entry.inStock,
        price: entry.price,
        salePrice: entry.salePrice ?? null,
        onSale: Boolean(entry.onSale),
        unitPriceLabel: fmtPrice(entry),
        lineTotalPrice: pricing.lineTotalPrice,
        lineTotalLabel:
          typeof pricing.lineTotalPrice === "number" ? fmtMoney(pricing.lineTotalPrice) : "",
        billableQuantity: pricing.billableQuantity,
        billableUnit: pricing.billableUnit || "",
        pricingMode: pricing.pricingMode
      };
    })
    .sort((a, b) => scoreOpt(b, item, size) - scoreOpt(a, item, size))
    .slice(0, MAX_OPTIONS);

  const uniqueBrands = new Set(opts.map((entry) => normalizeText(entry.brand)));
  if (uniqueBrands.size <= 1) {
    return null;
  }

  return {
    action,
    requestedItem: item,
    quantity,
    unit,
    size,
    options: opts
  };
};

export const createBrandSelectionConfirmation = ({ proposal, parsed, mode }) => {
  cleanExpired();

  const token = uuidv4();
  const expiresAtMs = Date.now() + BRAND_SELECTION_TTL_MS;

  pendingBrandPicks.set(token, {
    proposal,
    parsed,
    mode,
    expiresAtMs
  });

  return {
    token,
    expiresAt: new Date(expiresAtMs).toISOString(),
    requestedItem: proposal.requestedItem,
    quantity: proposal.quantity,
    unit: proposal.unit,
    size: proposal.size,
    action: proposal.action,
    options: proposal.options
  };
};

export const consumeBrandSelectionConfirmation = (token) => {
  cleanExpired();
  const payload = pendingBrandPicks.get(token);
  if (!payload) return null;
  pendingBrandPicks.delete(token);
  return payload;
};

export const rejectBrandSelectionConfirmation = (token) => {
  cleanExpired();
  if (!pendingBrandPicks.has(token)) {
    return false;
  }
  pendingBrandPicks.delete(token);
  return true;
};


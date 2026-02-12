import { v4 as uuidv4 } from "uuid";
import { filterCatalog, findBestCatalogMatch, normalizeText } from "./catalogService.js";
import { getCatalogSnapshot } from "./catalogRepository.js";
import { computePricingSnapshot } from "./pricingService.js";

const CONFIRM_TTL_MS = 10 * 60 * 1000;
const MAX_ALT_OPTS = 12;
const pendingSubs = new Map();

const effPrice = (entry) =>
  entry.onSale && typeof entry.salePrice === "number" ? entry.salePrice : entry.price;
const formatMoney = (value) => `$${Number(value).toFixed(2)}`;

const cleanExpired = () => {
  const now = Date.now();
  for (const [token, payload] of pendingSubs.entries()) {
    if (payload.expiresAtMs <= now) {
      pendingSubs.delete(token);
    }
  }
};

const getPrefAlts = (preferences, requestedName) => {
  const key = Object.keys(preferences || {}).find((entry) => {
    const normalizedKey = normalizeText(entry);
    const normalizedRequested = normalizeText(requestedName);
    return (
      normalizedKey === normalizedRequested ||
      normalizedKey.includes(normalizedRequested) ||
      normalizedRequested.includes(normalizedKey)
    );
  });

  return key ? preferences[key] || [] : [];
};

const findAltByName = (name) => {
  const matches = filterCatalog({ query: name, inStockOnly: true });
  return matches[0] || null;
};

const findCatFallback = (requestedProduct) => {
  const catalog = getCatalogSnapshot();
  if (!requestedProduct?.category) return null;
  return (
    catalog.find(
      (entry) =>
        entry.category === requestedProduct.category &&
        entry.inStock &&
        normalizeText(entry.name) !== normalizeText(requestedProduct.name)
    ) || null
  );
};

const scoreAlt = ({ entry, requestedName, requestedBrand, sourceRank }) => {
  const normalizedRequestedName = normalizeText(requestedName);
  const normalizedRequestedBrand = normalizeText(requestedBrand || "");
  const normalizedName = normalizeText(entry.name);
  const normalizedBrand = normalizeText(entry.brand);

  let score = sourceRank;
  if (normalizedName === normalizedRequestedName) score += 8;
  if (normalizedName.includes(normalizedRequestedName)) score += 5;
  if (normalizedRequestedName.includes(normalizedName)) score += 4;
  if (normalizedRequestedBrand && normalizedBrand === normalizedRequestedBrand) score += 3;
  if (entry.inStock) score += 1;

  return score;
};

const mkOpt = ({
  entry,
  requestedName,
  requestedBrand,
  sourceRank,
  quantity,
  unit
}) => {
  if (!entry || !entry.inStock) {
    return null;
  }

  const unitPrice = effPrice(entry);
  const hasUnitPrice = Number.isFinite(Number(unitPrice)) && Number(unitPrice) > 0;
  const pricing = computePricingSnapshot({
    quantity,
    unit,
    size: entry.size || "",
    unitPrice
  });

  return {
    sku: entry.sku || `${normalizeText(entry.name)}|${normalizeText(entry.brand)}|${normalizeText(entry.size || "")}`,
    name: entry.name,
    brand: entry.brand || "Generic",
    size: entry.size || "",
    category: entry.category || "others",
    inStock: Boolean(entry.inStock),
    price: entry.price,
    salePrice: entry.salePrice ?? null,
    onSale: Boolean(entry.onSale),
    unitPrice: hasUnitPrice ? Number(unitPrice) : null,
    unitPriceLabel: hasUnitPrice ? formatMoney(unitPrice) : "-",
    lineTotalPrice: pricing.lineTotalPrice,
    lineTotalLabel:
      typeof pricing.lineTotalPrice === "number" ? formatMoney(pricing.lineTotalPrice) : "",
    billableQuantity: pricing.billableQuantity,
    billableUnit: pricing.billableUnit || "",
    pricingMode: pricing.pricingMode,
    _score: scoreAlt({ entry, requestedName, requestedBrand, sourceRank })
  };
};

const putOpt = (map, option) => {
  if (!option) return;
  const existing = map.get(option.sku);
  if (!existing || option._score > existing._score) {
    map.set(option.sku, option);
  }
};

export const buildSubstituteProposal = ({
  item,
  brand = "",
  size = "",
  quantity = 1,
  unit = "unit",
  mode = "increment",
  preferences = {}
}) => {
  const requested = findBestCatalogMatch({ name: item, brand, size });
  if (requested && requested.inStock) {
    return null;
  }

  const requestedName = requested?.name || item;
  const requestedBrand = requested?.brand || brand || "";

  const preferenceAlternatives = getPrefAlts(preferences, requestedName);
  const catalogAlternatives = requested?.substitutes || [];
  const optionMap = new Map();

  for (const candidate of preferenceAlternatives) {
    const matches = filterCatalog({
      query: candidate,
      inStockOnly: true
    }).slice(0, 4);

    matches.forEach((entry) =>
      putOpt(
        optionMap,
        mkOpt({
          entry,
          requestedName,
          requestedBrand,
          sourceRank: 90,
          quantity,
          unit
        })
      )
    );
  }

  for (const candidate of catalogAlternatives) {
    const matches = filterCatalog({
      query: candidate,
      inStockOnly: true
    }).slice(0, 4);

    matches.forEach((entry) =>
      putOpt(
        optionMap,
        mkOpt({
          entry,
          requestedName,
          requestedBrand,
          sourceRank: 75,
          quantity,
          unit
        })
      )
    );
  }

  const exactNameMatches = filterCatalog({
    query: requestedName || item,
    brand,
    size,
    inStockOnly: true
  }).slice(0, 8);

  exactNameMatches.forEach((entry) =>
    putOpt(
      optionMap,
      mkOpt({
        entry,
        requestedName,
        requestedBrand,
        sourceRank: requested ? 85 : 70,
        quantity,
        unit
      })
    )
  );

  if (!requested) {
    const fallbackMatches = filterCatalog({
      query: item,
      inStockOnly: true
    }).slice(0, 8);

    fallbackMatches.forEach((entry) =>
      putOpt(
        optionMap,
        mkOpt({
          entry,
          requestedName,
          requestedBrand,
          sourceRank: 60,
          quantity,
          unit
        })
      )
    );
  }

  const categoryFallback = findCatFallback(requested);
  if (categoryFallback) {
    putOpt(
      optionMap,
      mkOpt({
        entry: categoryFallback,
        requestedName,
        requestedBrand,
        sourceRank: 40,
        quantity,
        unit
      })
    );
  }

  const options = [...optionMap.values()]
    .sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      const aPrice = Number.isFinite(Number(a.lineTotalPrice)) ? Number(a.lineTotalPrice) : Number.POSITIVE_INFINITY;
      const bPrice = Number.isFinite(Number(b.lineTotalPrice)) ? Number(b.lineTotalPrice) : Number.POSITIVE_INFINITY;
      if (aPrice !== bPrice) return aPrice - bPrice;
      return `${a.name}|${a.brand}`.localeCompare(`${b.name}|${b.brand}`);
    })
    .slice(0, MAX_ALT_OPTS)
    .map((entry) => {
      const { _score, ...safeEntry } = entry;
      return safeEntry;
    });

  if (!options.length) {
    const directAlternative = findAltByName(item);
    if (directAlternative) {
      options.push(
        mkOpt({
          entry: directAlternative,
          requestedName,
          requestedBrand,
          sourceRank: 50,
          quantity,
          unit
        })
      );
    }
  }

  const cleanOptions = options.filter(Boolean);
  const sanitizedOptions = cleanOptions.map((entry) => {
    const { _score, ...safeEntry } = entry;
    return safeEntry;
  });

  if (!sanitizedOptions.length) {
    return null;
  }

  const suggestedAlternative = sanitizedOptions[0];

  return {
    requestedItem: {
      name: requestedName,
      brand: requestedBrand || "Generic",
      size: requested?.size || size || "",
      existsInCatalog: Boolean(requested),
      inStock: requested?.inStock ?? false
    },
    suggestedAlternative,
    options: sanitizedOptions,
    quantity,
    unit,
    mode
  };
};

export const createSubstituteConfirmation = (proposal) => {
  cleanExpired();

  const token = uuidv4();
  const expiresAtMs = Date.now() + CONFIRM_TTL_MS;
  pendingSubs.set(token, {
    ...proposal,
    expiresAtMs
  });

  return {
    token,
    expiresAt: new Date(expiresAtMs).toISOString(),
    requestedItem: proposal.requestedItem,
    suggestedAlternative: proposal.suggestedAlternative,
    options: proposal.options || [],
    quantity: proposal.quantity,
    unit: proposal.unit,
    mode: proposal.mode
  };
};

export const consumeSubstituteConfirmation = (token) => {
  cleanExpired();
  const payload = pendingSubs.get(token);
  if (!payload) return null;

  pendingSubs.delete(token);
  return payload;
};

export const rejectSubstituteConfirmation = (token) => {
  cleanExpired();
  if (!pendingSubs.has(token)) {
    return false;
  }
  pendingSubs.delete(token);
  return true;
};



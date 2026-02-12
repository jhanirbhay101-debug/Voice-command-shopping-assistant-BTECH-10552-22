import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env.js";
import { filterCatalog, findBestCatalogMatch, normalizeText } from "./catalogService.js";
import { getCatalogSnapshot } from "./catalogRepository.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const SEASON_TTL = 6 * 60 * 60 * 1000;
const MAX_G = 6;

let seasonModel = null;
const seasonCache = new Map();

const EFFECTIVE_PRICE = (entry) =>
  entry.onSale && typeof entry.salePrice === "number" ? entry.salePrice : entry.price;

const normHist = (history = []) =>
  history
    .map((entry) => {
      if (typeof entry === "string") {
        return {
          name: normalizeText(entry),
          brand: "Generic",
          quantity: 1,
          unit: "unit",
          action: "add",
          timestamp: null
        };
      }

      return {
        name: normalizeText(entry.name || ""),
        brand: entry.brand || "Generic",
        quantity: Number(entry.quantity) || 1,
        unit: entry.unit || "unit",
        action: entry.action || "add",
        timestamp: entry.timestamp || null
      };
    })
    .filter((entry) => entry.name);

const daysGap = (dateIso) => {
  if (!dateIso) return null;
  const timestamp = new Date(dateIso).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.floor((Date.now() - timestamp) / DAY_MS);
};

const dedupe = (items) => {
  const seen = new Set();
  return items.filter((entry) => {
    const key = `${entry.type}:${entry.item}:${entry.brand || ""}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const listKey = (entry) => `${normalizeText(entry.name)}|${normalizeText(entry.brand || "generic")}`;

const buildProdRecs = ({ history, preferences, list }) => {
  const normalizedHistory = normHist(history).filter((entry) =>
    ["add", "update"].includes(entry.action)
  );

  const grouped = new Map();
  for (const entry of normalizedHistory) {
    const key = `${normalizeText(entry.name)}|${normalizeText(entry.brand || "generic")}`;
    const current = grouped.get(key) || {
      item: entry.name,
      brand: entry.brand || "Generic",
      purchaseEvents: 0,
      totalQty: 0,
      timestamps: []
    };

    current.purchaseEvents += 1;
    current.totalQty += entry.quantity;
    if (entry.timestamp) current.timestamps.push(new Date(entry.timestamp).getTime());
    grouped.set(key, current);
  }

  const listMap = new Map(list.map((entry) => [listKey(entry), entry]));
  const recommendations = [];

  grouped.forEach((record, key) => {
    if (record.purchaseEvents < 2) return;

    const sortedTs = [...record.timestamps].sort((a, b) => a - b);
    let avgIntervalDays = null;

    if (sortedTs.length >= 2) {
      let totalGap = 0;
      for (let i = 1; i < sortedTs.length; i += 1) {
        totalGap += sortedTs[i] - sortedTs[i - 1];
      }
      avgIntervalDays = Math.max(1, Math.round(totalGap / (sortedTs.length - 1) / DAY_MS));
    }

    const lastTs = sortedTs[sortedTs.length - 1];
    const daysSinceLast = lastTs ? daysGap(new Date(lastTs).toISOString()) : null;
    const listEntry = listMap.get(key);
    const averageQtyPerPurchase = Math.max(1, Math.round(record.totalQty / record.purchaseEvents));
    const lowQtyThreshold = Math.max(1, Math.round(averageQtyPerPurchase * 0.5));

    const missingFromList = !listEntry;
    const lowQuantity = listEntry && listEntry.quantity <= lowQtyThreshold;
    const dueByCadence =
      missingFromList &&
      avgIntervalDays !== null &&
      daysSinceLast !== null &&
      daysSinceLast >= Math.max(3, Math.floor(avgIntervalDays * 0.8));

    const likelyNeed = missingFromList && record.purchaseEvents >= 3;

    if (!(dueByCadence || lowQuantity || likelyNeed)) return;

    let message = `It looks like you're running low on ${record.item}.`;
    let score = 0;

    if (dueByCadence) {
      message = `It looks like you're running low on ${record.item}. You usually buy it every ${avgIntervalDays} day(s), and last bought it ${daysSinceLast} day(s) ago.`;
      score = 100 + record.purchaseEvents;
    } else if (lowQuantity) {
      message = `It looks like you're running low on ${record.item}. You currently have ${listEntry.quantity} ${listEntry.unit}, while your usual purchase amount is around ${averageQtyPerPurchase}.`;
      score = 80 + record.purchaseEvents;
    } else {
      message = `You frequently buy ${record.item}. Consider adding it before your next trip.`;
      score = 60 + record.purchaseEvents;
    }

    recommendations.push({
      type: "product",
      item: record.item,
      brand: record.brand,
      score,
      message
    });
  });

  const listNames = new Set(list.map((entry) => normalizeText(entry.name)));
  Object.keys(preferences || {}).forEach((itemName) => {
    if (listNames.has(normalizeText(itemName))) return;
    recommendations.push({
      type: "product_preference",
      item: itemName,
      brand: "",
      score: 50,
      message: `Based on your preferences, you may need ${itemName}.`
    });
  });

  return dedupe(
    recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_G)
  );
};

const fallbackSeasonRecs = () => {
  const catalog = getCatalogSnapshot();
  const month = new Date().getMonth() + 1;

  const seasonal = catalog
    .filter((entry) => (entry.seasonMonths || []).includes(month))
    .map((entry) => ({
      type: "seasonal",
      item: entry.name,
      brand: entry.brand,
      message: `${entry.name} is typically in season this month.`
    }));

  const sales = catalog
    .filter((entry) => entry.onSale)
    .map((entry) => ({
      type: "seasonal_sale",
      item: entry.name,
      brand: entry.brand,
      message: `${entry.name} is currently on sale for $${EFFECTIVE_PRICE(entry).toFixed(2)}.`
    }));

  return dedupe([...seasonal, ...sales]).slice(0, MAX_G);
};

const getSeasonModel = () => {
  if (env.disableGemini || !env.geminiApiKey) {
    return null;
  }

  if (!seasonModel) {
    const genAI = new GoogleGenerativeAI(env.geminiApiKey);
    seasonModel = genAI.getGenerativeModel({ model: env.geminiModel });
  }

  return seasonModel;
};

const parseAi = (text) => {
  if (!text) return null;

  const trimmed = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\[[\s\S]*\]/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
};

const buildAiSeasonRecs = async () => {
  const model = getSeasonModel();
  if (!model) return null;
  const catalog = getCatalogSnapshot();

  const now = new Date();
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long" }).format(now);
  const monthNumber = now.getMonth() + 1;
  const cacheKey = `${monthNumber}:${env.seasonalRegion}`;
  const cached = seasonCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const catalogSummary = catalog.map((entry) => ({
    name: entry.name,
    brand: entry.brand,
    category: entry.category,
    onSale: Boolean(entry.onSale),
    salePrice: entry.salePrice ?? null,
    price: entry.price
  }));

  const prompt = `
You are a grocery recommendation assistant.
Month: ${monthName}
Region: ${env.seasonalRegion}
Catalog entries JSON: ${JSON.stringify(catalogSummary)}

Pick up to 6 recommendations that are either:
1) in-season items for the given month/region, or
2) currently on-sale items.

Return ONLY JSON array with objects:
[
  {
    "item": "catalog item name exactly",
    "brand": "catalog brand exactly",
    "type": "seasonal|sale",
    "reason": "short reason"
  }
]
Do not return markdown.
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = parseAi(text);
    if (!Array.isArray(parsed)) {
      return null;
    }

    const recommendations = parsed
      .map((entry) => {
        const candidate = findBestCatalogMatch({
          name: entry.item || "",
          brand: entry.brand || ""
        });

        if (!candidate) return null;

        const type = entry.type === "sale" ? "seasonal_sale" : "seasonal";
        const reason = String(entry.reason || "").trim();

        const message =
          type === "seasonal_sale"
            ? `${candidate.name} is on sale for $${EFFECTIVE_PRICE(candidate).toFixed(2)}. ${reason}`.trim()
            : `${candidate.name} is in season around ${monthName}. ${reason}`.trim();

        return {
          type,
          item: candidate.name,
          brand: candidate.brand,
          message
        };
      })
      .filter(Boolean);

    const deduped = dedupe(recommendations).slice(0, MAX_G);
    seasonCache.set(cacheKey, {
      value: deduped,
      expiresAt: Date.now() + SEASON_TTL
    });

    return deduped;
  } catch {
    return null;
  }
};

const buildSubRecs = ({ list, preferences, focusItem }) => {
  const targets = focusItem
    ? [normalizeText(focusItem)]
    : list.map((entry) => normalizeText(entry.name));

  const recommendations = [];

  targets.forEach((target) => {
    const requested = findBestCatalogMatch({ name: target });
    if (requested && !requested.inStock) {
      (requested.substitutes || []).forEach((substituteName) => {
        const inStockMatch = filterCatalog({
          query: substituteName,
          inStockOnly: true
        })[0];

        if (inStockMatch) {
          recommendations.push({
            type: "substitute",
            item: inStockMatch.name,
            brand: inStockMatch.brand,
            message: `${requested.name} is out of stock. ${inStockMatch.name} by ${inStockMatch.brand} is available as an alternative.`
          });
        }
      });
    }
  });

  Object.entries(preferences || {}).forEach(([baseItem, alternatives]) => {
    alternatives.forEach((alt) => {
      const inStockMatch = filterCatalog({ query: alt, inStockOnly: true })[0];
      if (!inStockMatch) return;

      recommendations.push({
        type: "substitute_preference",
        item: inStockMatch.name,
        brand: inStockMatch.brand,
        message: `Preferred substitute for ${baseItem}: ${inStockMatch.name} by ${inStockMatch.brand}.`
      });
    });
  });

  return dedupe(recommendations).slice(0, MAX_G);
};

export const buildSuggestions = async ({ history, preferences, list, focusItem }) => {
  let productRecommendations = [];
  let seasonalRecommendations = [];
  let substituteRecommendations = [];

  try {
    productRecommendations = buildProdRecs({
      history,
      preferences,
      list
    });
  } catch {
    productRecommendations = [];
  }

  try {
    seasonalRecommendations =
      (await buildAiSeasonRecs()) || fallbackSeasonRecs();
  } catch {
    seasonalRecommendations = fallbackSeasonRecs();
  }

  try {
    substituteRecommendations = buildSubRecs({
      list,
      preferences,
      focusItem
    });
  } catch {
    substituteRecommendations = [];
  }

  const suggestions = dedupe([
    ...productRecommendations,
    ...seasonalRecommendations,
    ...substituteRecommendations
  ]).slice(0, productRecommendations.length + seasonalRecommendations.length + substituteRecommendations.length);

  return {
    productRecommendations,
    seasonalRecommendations,
    substituteRecommendations,
    suggestions
  };
};



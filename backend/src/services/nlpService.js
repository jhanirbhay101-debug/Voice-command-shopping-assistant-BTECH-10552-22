import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env.js";
import { getKnownBrands, normalizeText } from "./catalogService.js";

const getKnownBrandTokens = () =>
  getKnownBrands().map((brand) => ({
    raw: brand,
    normalized: brand.toLowerCase()
  }));

const actionMap = {
  add: ["add", "need", "buy", "want", "agrega", "necesito", "comprar", "chahiye", "mujhe"],
  remove: ["remove", "delete", "quit", "elimina", "quita", "hatao", "nikalo"],
  update: ["update", "change", "set", "modify", "actualiza", "cambia", "badal", "set karo"],
  search: ["find", "search", "look", "buscar", "encuentra", "dhundo", "khojo"]
};

const numberWords = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  ek: 1,
  do: 2,
  teen: 3,
  char: 4,
  paanch: 5,
  chhe: 6,
  saat: 7,
  aath: 8,
  nau: 9,
  das: 10,
  ekk: 1,
  un: 1,
  una: 1,
  unaa: 1,
  "एक": 1,
  "दो": 2,
  "तीन": 3,
  "चार": 4,
  "पांच": 5,
  "पाँच": 5,
  "छः": 6,
  "छह": 6,
  "सात": 7,
  "आठ": 8,
  "नौ": 9,
  "दस": 10
};

const unitAliases = {
  units: "unit",
  unit: "unit",
  unidad: "unit",
  unidades: "unit",
  pcs: "piece",
  piece: "piece",
  pieces: "piece",
  pieza: "piece",
  piezas: "piece",
  pc: "piece",
  bottle: "bottle",
  bottles: "bottle",
  botella: "bottle",
  botellas: "bottle",
  pack: "pack",
  packs: "pack",
  paquete: "pack",
  paquetes: "pack",
  kg: "kg",
  kilo: "kg",
  kilos: "kg",
  kilogram: "kg",
  kilograms: "kg",
  kilogramo: "kg",
  kilogramos: "kg",
  "किलो": "kg",
  "किलोग्राम": "kg",
  g: "g",
  gram: "g",
  grams: "g",
  gramo: "g",
  gramos: "g",
  "ग्राम": "g",
  l: "liter",
  litre: "liter",
  liter: "liter",
  litres: "liter",
  liters: "liter",
  litro: "liter",
  litros: "liter",
  "लीटर": "liter",
  ml: "ml",
  mililitro: "ml",
  mililitros: "ml",
  "मिलीलीटर": "ml"
};

const quantityUnitPattern = /(\d+(?:\.\d+)?)\s*(kilograms|kilogram|kilos|kilo|kg|gramos|gramo|grams|gram|g|liters|litres|liter|litre|litros|litro|l|mililitros|mililitro|ml|botellas|botella|bottles|bottle|paquetes|paquete|packs|pack|pieces|piece|piezas|pieza|pcs|unidades|unidad|units|unit)?/i;
const sizePattern = /(\d+(?:\.\d+)?)\s*(kg|g|ml|l|liters|litres|liter|litre|litros|litro|packs|pack|pieces|piece|pcs|paquetes|paquete|piezas|pieza)/i;

const maxPricePatterns = [
  /(?:under|below|less than|max|up to|upto|at most|menos de|debajo de|neeche|kam se kam)\s*\$?\s*(\d+(?:\.\d+)?)/i
];

const minPricePatterns = [
  /(?:above|over|more than|min|at least|greater than|mas de|zyada|upar)\s*\$?\s*(\d+(?:\.\d+)?)/i
];

const fillerWordsPattern = /\b(i|me|my|please|the|a|an|to|for|on|in|list|from|by|of|need|want|buy|add|remove|delete|set|update|change|find|search|look|brand|price|under|below|less|than|max|up|at|most|show|mujhe|mera|meri|lista|mi|por|con|ki|ko|mein|se|de|la|el|una|un|necesito|quiero|comprar|agrega|anade|añade|busca|encuentra)\b/gi;
const punctuationPattern = /[.,!?।]/g;

const GEMINI_SCHEMA_HINT = `
Return ONLY valid JSON with this exact schema:
{
  "action": "add|remove|update|search|unknown",
  "item": "string",
  "brand": "string",
  "quantity": number|null,
  "quantityProvided": boolean,
  "unit": "string",
  "size": "string",
  "filters": {
    "query": "string",
    "brand": "string",
    "size": "string",
    "maxPrice": number|null,
    "minPrice": number|null
  },
  "confidence": "high|medium|low"
}
Rules:
- Keep item clean (no filler words)
- If transcript is non-English, translate item, query and unit to English grocery terms
- For search commands, fill filters fields
- If quantity is absent for add/remove/update, set quantity=1 and quantityProvided=false
- Never include markdown or code fences.
`;

const ALLOWED_ACTIONS = new Set(["add", "remove", "update", "search", "unknown"]);
const ALLOWED_CONFIDENCE = new Set(["high", "medium", "low"]);

let geminiModel = null;

const PRODUCT_ALIAS_RULES = [
  {
    aliases: ["kitkat", "kit kat"],
    canonicalItem: "kitkat chocolate",
    canonicalBrand: "Nestle"
  },
  {
    aliases: ["perk"],
    canonicalItem: "perk chocolate",
    canonicalBrand: "Cadbury"
  }
];

const NON_ENGLISH_RULE_FIRST_LOCALES = ["hi", "es"];

const DEVANAGARI_DIGITS = {
  "०": "0",
  "१": "1",
  "२": "2",
  "३": "3",
  "४": "4",
  "५": "5",
  "६": "6",
  "७": "7",
  "८": "8",
  "९": "9"
};

const MULTILINGUAL_PHRASE_REPLACEMENTS = [
  { from: "pasta dental", to: "toothpaste" },
  { from: "aceite de cocina", to: "cooking oil" },
  { from: "गेहूं का आटा", to: "whole wheat flour" },
  { from: "गेहूँ का आटा", to: "whole wheat flour" },
  { from: "दांत का पेस्ट", to: "toothpaste" },
  { from: "मुँह धोने का", to: "mouthwash" },

  { from: "agrega", to: "add" },
  { from: "añade", to: "add" },
  { from: "anade", to: "add" },
  { from: "necesito", to: "need" },
  { from: "quiero", to: "want" },
  { from: "compra", to: "buy" },
  { from: "comprar", to: "buy" },
  { from: "elimina", to: "remove" },
  { from: "quita", to: "remove" },
  { from: "busca", to: "find" },
  { from: "encuentra", to: "find" },

  { from: "मुझे", to: "need" },
  { from: "चाहिए", to: "need" },
  { from: "चाहिये", to: "need" },
  { from: "जोड़ो", to: "add" },
  { from: "जोड़ो", to: "add" },
  { from: "डालो", to: "add" },
  { from: "हटाओ", to: "remove" },
  { from: "निकालो", to: "remove" },
  { from: "ढूंढो", to: "find" },
  { from: "ढूँढो", to: "find" },
  { from: "खोजो", to: "find" },
  { from: "किलो", to: "kg" },
  { from: "किलोग्राम", to: "kg" },
  { from: "ग्राम", to: "g" },
  { from: "लीटर", to: "liter" },
  { from: "मिलीलीटर", to: "ml" },
  { from: "बोतलें", to: "bottles" },
  { from: "बोतल", to: "bottle" },
  { from: "पैक", to: "pack" },
  { from: "पीस", to: "piece" },
  { from: "टुकड़े", to: "pieces" },
  { from: "टुकड़ा", to: "piece" },

  { from: "manzanas", to: "apples" },
  { from: "manzana", to: "apple" },
  { from: "platanos", to: "bananas" },
  { from: "platano", to: "banana" },
  { from: "bananos", to: "bananas" },
  { from: "banano", to: "banana" },
  { from: "naranjas", to: "oranges" },
  { from: "naranja", to: "orange" },
  { from: "leche", to: "milk" },
  { from: "pan", to: "bread" },
  { from: "arroz", to: "rice" },
  { from: "harina", to: "flour" },
  { from: "tomates", to: "tomatoes" },
  { from: "tomate", to: "tomato" },
  { from: "patatas", to: "potatoes" },
  { from: "patata", to: "potato" },
  { from: "papas", to: "potatoes" },
  { from: "papa", to: "potato" },
  { from: "cebollas", to: "onions" },
  { from: "cebolla", to: "onion" },
  { from: "huevos", to: "eggs" },
  { from: "huevo", to: "egg" },
  { from: "mantequilla", to: "butter" },
  { from: "yogur", to: "yogurt" },
  { from: "jabon", to: "soap" },
  { from: "champu", to: "shampoo" },
  { from: "agua", to: "water" },
  { from: "aceite", to: "oil" },
  { from: "cafe", to: "coffee" },
  { from: "té", to: "tea" },
  { from: "te", to: "tea" },

  { from: "सेब", to: "apples" },
  { from: "केला", to: "banana" },
  { from: "केले", to: "bananas" },
  { from: "संतरा", to: "orange" },
  { from: "संतरे", to: "oranges" },
  { from: "दूध", to: "milk" },
  { from: "ब्रेड", to: "bread" },
  { from: "चावल", to: "rice" },
  { from: "आटा", to: "flour" },
  { from: "टमाटर", to: "tomatoes" },
  { from: "आलू", to: "potatoes" },
  { from: "प्याज", to: "onions" },
  { from: "प्याज़", to: "onions" },
  { from: "अंडा", to: "egg" },
  { from: "अंडे", to: "eggs" },
  { from: "मक्खन", to: "butter" },
  { from: "दही", to: "yogurt" },
  { from: "पनीर", to: "paneer" },
  { from: "टूथपेस्ट", to: "toothpaste" },
  { from: "साबुन", to: "soap" },
  { from: "शैम्पू", to: "shampoo" },
  { from: "चॉकलेट", to: "chocolate" },
  { from: "किटकैट", to: "kitkat chocolate" },
  { from: "पर्क", to: "perk chocolate" },
  { from: "कॉफी", to: "coffee" },
  { from: "चाय", to: "tea" },
  { from: "पानी", to: "water" },
  { from: "तेल", to: "oil" },

  { from: "seb", to: "apples" },
  { from: "kela", to: "banana" },
  { from: "kele", to: "bananas" },
  { from: "santara", to: "orange" },
  { from: "santre", to: "oranges" },
  { from: "doodh", to: "milk" },
  { from: "atta", to: "flour" },
  { from: "tamatar", to: "tomatoes" },
  { from: "aloo", to: "potatoes" },
  { from: "pyaz", to: "onions" },
  { from: "ande", to: "eggs" },
  { from: "paani", to: "water" }
];

const escapeRegExp = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const replaceWholePhrase = (text, phrase, replacement) => {
  const pattern = new RegExp(`(^|\\s)${escapeRegExp(phrase)}(?=\\s|$)`, "giu");
  return text.replace(pattern, (_, prefix) => `${prefix}${replacement}`);
};

const normalizeIndicDigits = (text) =>
  text.replace(/[०-९]/g, (digit) => DEVANAGARI_DIGITS[digit] || digit);

const normalizeMultilingualTerms = (text) => {
  let updated = normalizeIndicDigits(text);

  MULTILINGUAL_PHRASE_REPLACEMENTS
    .slice()
    .sort((a, b) => b.from.length - a.from.length)
    .forEach(({ from, to }) => {
      updated = replaceWholePhrase(updated, from, to);
    });

  return updated.replace(/\s+/g, " ").trim();
};

const normalizeCatalogPhrase = (text = "") =>
  normalizeMultilingualTerms(String(text).toLowerCase().replace(punctuationPattern, " "));

const shouldPreferRuleForLocale = (language = "en-US") =>
  NON_ENGLISH_RULE_FIRST_LOCALES.some((prefix) =>
    String(language || "").toLowerCase().startsWith(prefix)
  );

const GEMINI_GENERIC_ITEMS = new Set([
  "item",
  "items",
  "product",
  "products",
  "thing",
  "things",
  "cup",
  "cups",
  "unit",
  "units"
]);

const replaceNumberWords = (text) => {
  let updated = text;

  Object.entries(numberWords)
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([word, value]) => {
      updated = replaceWholePhrase(updated, word, String(value));
  });

  return updated;
};

const detectAction = (text) => {
  for (const [action, verbs] of Object.entries(actionMap)) {
    if (verbs.some((verb) => new RegExp(`\\b${verb}\\b`, "i").test(text))) {
      return action;
    }
  }
  return "add";
};

const extractPriceFilters = (text) => {
  let maxPrice = null;
  let minPrice = null;

  for (const pattern of maxPricePatterns) {
    const match = text.match(pattern);
    if (match) {
      maxPrice = Number(match[1]);
      break;
    }
  }

  for (const pattern of minPricePatterns) {
    const match = text.match(pattern);
    if (match) {
      minPrice = Number(match[1]);
      break;
    }
  }

  return { maxPrice, minPrice };
};

const extractBrand = (text, action) => {
  const normalized = normalizeText(text);
  const knownBrands = getKnownBrandTokens();
  const knownBrand = knownBrands
    .sort((a, b) => b.normalized.length - a.normalized.length)
    .find((brand) => normalized.includes(brand.normalized));

  if (knownBrand) {
    return knownBrand.raw;
  }

  if (action !== "search") {
    return "";
  }

  const match = normalized.match(/(?:brand|from|by|marca)\s+([a-z0-9\s-]+)/i);
  if (!match) return "";

  return match[1]
    .replace(/(?:under|below|less|than|max|size|for).*/i, "")
    .trim();
};

const toCanonicalUnit = (unit = "") => {
  if (!unit) return "unit";
  const key = unit.toLowerCase();
  return unitAliases[key] || key;
};

const extractQuantityAndUnit = (text, action) => {
  if (action === "search") {
    return { quantity: null, unit: "unit", quantityProvided: false };
  }

  const match = text.match(quantityUnitPattern);
  if (!match) {
    return { quantity: 1, unit: "unit", quantityProvided: false };
  }

  const quantity = Number(match[1]);
  const unit = toCanonicalUnit(match[2]);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { quantity: 1, unit, quantityProvided: false };
  }

  return { quantity, unit, quantityProvided: true };
};

const extractSize = (text) => {
  const match = text.match(sizePattern);
  if (!match) return "";

  const unit = toCanonicalUnit(match[2]);
  return `${match[1]}${unit === "liter" ? "l" : unit}`;
};

const removeKnownPhrases = (text, action, quantityMatch, priceFilters, brand, size) => {
  let cleaned = text;

  Object.values(actionMap).flat().forEach((verb) => {
    cleaned = cleaned.replace(new RegExp(`\\b${verb}\\b`, "gi"), " ");
  });

  if (quantityMatch) {
    cleaned = cleaned.replace(quantityMatch[0], " ");
  }

  if (priceFilters.maxPrice !== null) {
    cleaned = cleaned.replace(maxPricePatterns[0], " ");
  }
  if (priceFilters.minPrice !== null) {
    cleaned = cleaned.replace(minPricePatterns[0], " ");
  }

  if (brand) {
    cleaned = cleaned.replace(new RegExp(`\\b${brand}\\b`, "gi"), " ");
  }

  if (action === "search" && size) {
    cleaned = cleaned.replace(sizePattern, " ");
  }

  cleaned = cleaned.replace(fillerWordsPattern, " ");
  cleaned = cleaned.replace(/\$/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
};

const normalizeNumeric = (value, fallback = null) => {
  if (value === null || typeof value === "undefined" || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const applyProductAliasCorrections = (parsed) => {
  const next = { ...parsed, filters: { ...(parsed.filters || {}) } };
  const item = normalizeText(next.item || "");
  const brand = normalizeText(next.brand || "");
  const query = normalizeText(next.filters.query || next.item || "");

  PRODUCT_ALIAS_RULES.forEach((rule) => {
    const aliasMatchedInBrand = rule.aliases.some((alias) => brand === alias);
    const aliasMatchedInItem = rule.aliases.some((alias) => item.includes(alias));
    const aliasMatchedInQuery = rule.aliases.some((alias) => query.includes(alias));

    const genericChocolateMentioned =
      item.includes("chocolate") ||
      item.includes("chocolates") ||
      item.includes("chocholate") ||
      item.includes("chocholates") ||
      query.includes("chocolate") ||
      query.includes("chocolates");

    if (aliasMatchedInBrand || aliasMatchedInItem || (aliasMatchedInQuery && genericChocolateMentioned)) {
      next.item = rule.canonicalItem;
      next.brand = rule.canonicalBrand;
      next.filters.query = rule.canonicalItem;
      next.filters.brand = rule.canonicalBrand;
    }
  });

  return next;
};

const extractJsonObject = (text) => {
  if (!text) return null;

  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
};

const shouldFallbackFromGemini = (geminiParsed, fallbackParsed) => {
  const geminiItem = normalizeText(geminiParsed.item || "");
  const fallbackItem = normalizeText(fallbackParsed.item || "");

  if (!geminiItem && fallbackItem) {
    return true;
  }

  if (GEMINI_GENERIC_ITEMS.has(geminiItem) && fallbackItem && !GEMINI_GENERIC_ITEMS.has(fallbackItem)) {
    return true;
  }

  return false;
};

const normalizeGeminiResult = (rawParsed, fallbackParsed, transcript, language) => {
  if (!rawParsed || typeof rawParsed !== "object") {
    return { ...fallbackParsed, source: "rule" };
  }

  const action = ALLOWED_ACTIONS.has(String(rawParsed.action || "").toLowerCase())
    ? String(rawParsed.action).toLowerCase()
    : fallbackParsed.action;

  const brand = String(rawParsed.brand || "").trim();
  const item = String(rawParsed.item || "").trim() || fallbackParsed.item;
  const unit = toCanonicalUnit(String(rawParsed.unit || fallbackParsed.unit || "unit"));

  const quantityDefault = action === "search" ? null : 1;
  const quantity = normalizeNumeric(rawParsed.quantity, quantityDefault);

  const quantityProvided =
    typeof rawParsed.quantityProvided === "boolean"
      ? rawParsed.quantityProvided
      : action === "search"
        ? false
        : quantity !== 1;

  const filters = rawParsed.filters && typeof rawParsed.filters === "object" ? rawParsed.filters : {};

  const normalized = {
    action,
    item: normalizeCatalogPhrase(item),
    brand,
    quantity,
    quantityProvided,
    unit,
    size: String(rawParsed.size || filters.size || "").trim(),
    filters: {
      query: normalizeCatalogPhrase(String(filters.query || item || "").trim()),
      brand: String(filters.brand || brand || "").trim(),
      size: String(filters.size || rawParsed.size || "").trim(),
      maxPrice: normalizeNumeric(filters.maxPrice, null),
      minPrice: normalizeNumeric(filters.minPrice, null)
    },
    language,
    confidence: ALLOWED_CONFIDENCE.has(String(rawParsed.confidence || "").toLowerCase())
      ? String(rawParsed.confidence).toLowerCase()
      : fallbackParsed.confidence,
    raw: transcript,
    source: "gemini"
  };

  if (!normalized.item && normalized.action !== "search") {
    return { ...fallbackParsed, source: "rule" };
  }

  if (normalized.action === "search") {
    normalized.quantity = null;
    normalized.quantityProvided = false;
    normalized.unit = "unit";
  }

  if (shouldFallbackFromGemini(normalized, fallbackParsed)) {
    return { ...fallbackParsed, source: "rule" };
  }

  return applyProductAliasCorrections(normalized);
};

const getGeminiModel = () => {
  if (env.disableGemini || !env.geminiApiKey) {
    return null;
  }

  if (!geminiModel) {
    const genAI = new GoogleGenerativeAI(env.geminiApiKey);
    geminiModel = genAI.getGenerativeModel({ model: env.geminiModel });
  }

  return geminiModel;
};

export const isGeminiEnabled = () => Boolean(getGeminiModel());

export const getParserMode = () => (isGeminiEnabled() ? "gemini+rule-fallback" : "rule-based");

export const parseVoiceCommand = (transcript, language = "en-US") => {
  const raw = (transcript || "").trim();

  if (!raw) {
    return {
      action: "unknown",
      item: "",
      brand: "",
      quantity: 1,
      unit: "unit",
      size: "",
      filters: {},
      language,
      confidence: "low",
      raw,
      source: "rule"
    };
  }

  const normalizedText = replaceNumberWords(normalizeCatalogPhrase(raw));
  const action = detectAction(normalizedText);
  const priceFilters = extractPriceFilters(normalizedText);
  const brand = extractBrand(normalizedText, action);
  const size = action === "search" ? extractSize(normalizedText) : "";
  const quantityMatch = normalizedText.match(quantityUnitPattern);
  const { quantity, unit, quantityProvided } = extractQuantityAndUnit(normalizedText, action);

  let item = removeKnownPhrases(
    normalizedText,
    action,
    quantityMatch,
    priceFilters,
    brand,
    size
  );

  if (!item && shouldPreferRuleForLocale(language)) {
    item = String(raw).trim();
  }

  const filters = {
    query: item,
    brand,
    size,
    maxPrice: priceFilters.maxPrice,
    minPrice: priceFilters.minPrice
  };

  const confidence = item ? "high" : action === "search" ? "medium" : "low";

  const parsed = {
    action,
    item,
    brand,
    quantity,
    quantityProvided,
    unit,
    size,
    filters,
    language,
    confidence,
    raw,
    source: "rule"
  };

  return applyProductAliasCorrections(parsed);
};

export const parseVoiceCommandSmart = async (transcript, language = "en-US") => {
  const fallbackParsed = parseVoiceCommand(transcript, language);
  if (shouldPreferRuleForLocale(language)) {
    return fallbackParsed;
  }

  const model = getGeminiModel();
  if (!model) {
    return fallbackParsed;
  }

  try {
    const prompt = `User language locale: ${language}\nTranscript: "${transcript}"\n${GEMINI_SCHEMA_HINT}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsedJson = extractJsonObject(responseText);

    return normalizeGeminiResult(parsedJson, fallbackParsed, transcript, language);
  } catch (error) {
    return {
      ...fallbackParsed,
      source: "rule"
    };
  }
};




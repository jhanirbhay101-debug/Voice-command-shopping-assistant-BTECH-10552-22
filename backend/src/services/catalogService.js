import { getCatalogSnapshot } from "./catalogRepository.js";

export const normalizeText = (value = "") => value.toLowerCase().trim();

const normTok = (tok = "") => {
  let out = tok.trim().toLowerCase();

  if (!out) return "";

  // Common speech-to-text variants for chocolate.
  out = out
    .replace(/chocholate/g, "chocolate")
    .replace(/chocholates/g, "chocolate")
    .replace(/choclate/g, "chocolate")
    .replace(/choclates/g, "chocolate");

  if (out.endsWith("es") && out.length > 4) {
    out = out.slice(0, -2);
  } else if (out.endsWith("s") && out.length > 3) {
    out = out.slice(0, -1);
  }

  return out;
};

const toks = (value = "") =>
  normalizeText(value)
    .split(/\s+/)
    .map((token) => normTok(token))
    .filter(Boolean);

const toNum = (value) => {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const effPrice = (row) => (row.onSale && row.salePrice ? row.salePrice : row.price);

const matchQ = (row, query) => {
  if (!query) return true;

  const tokens = toks(query);
  if (!tokens.length) return true;

  const haystack = `${row.name} ${row.brand} ${row.size}`.toLowerCase();
  return tokens.every((token) => haystack.includes(token));
};

export const filterCatalog = ({
  query = "",
  brand = "",
  size = "",
  maxPrice = null,
  minPrice = null,
  inStockOnly = false
} = {}) => {
  const cat = getCatalogSnapshot();
  const brandText = normalizeText(brand);
  const sizeText = normalizeText(size);
  const max = toNum(maxPrice);
  const min = toNum(minPrice);

  return cat
    .filter((row) => {
      const p = effPrice(row);

      const queryMatch = matchQ(row, query);
      const brandMatch = !brandText || row.brand.toLowerCase().includes(brandText);
      const sizeMatch = !sizeText || row.size.toLowerCase().includes(sizeText);
      const maxMatch = max === null || p <= max;
      const minMatch = min === null || p >= min;
      const stockMatch = !inStockOnly || row.inStock;

      return queryMatch && brandMatch && sizeMatch && maxMatch && minMatch && stockMatch;
    })
    .map((row) => ({
      ...row,
      effectivePrice: effPrice(row)
    }));
};

export const findBestCatalogMatch = ({ name = "", brand = "", size = "" } = {}) => {
  const cat = getCatalogSnapshot();
  const nameText = normalizeText(name);
  if (!nameText) {
    return null;
  }

  const nameToks = toks(nameText).filter((token) => token.length >= 2);
  const brandText = normalizeText(brand);
  const sizeText = normalizeText(size);

  const scored = cat
    .map((row) => {
      let rel = 0;
      const nameRow = row.name.toLowerCase();
      const brandRow = row.brand.toLowerCase();
      const sizeRow = row.size.toLowerCase();
      const exact = nameRow === nameText;

      if (exact) {
        rel += 12;
      }

      let tokHits = 0;
      nameToks.forEach((token) => {
        if (nameRow.includes(token)) {
          tokHits += 1;
          rel += 3;
        }
      });

      const loose =
        !exact &&
        (nameRow.includes(nameText) || nameText.includes(nameRow));
      if (loose) {
        rel += 2;
      }

      if (brandText && brandRow.includes(brandText)) {
        rel += 4;
      }

      if (sizeText && sizeRow.includes(sizeText)) {
        rel += 3;
      }

      const hasName = exact || tokHits > 0 || loose;
      if (!hasName) {
        rel = 0;
      }

      const score = rel + (row.inStock ? 0.5 : 0);
      return { score, relevance: rel, product: row };
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (b.relevance !== a.relevance) {
        return b.relevance - a.relevance;
      }
      if (a.product.inStock !== b.product.inStock) {
        return Number(b.product.inStock) - Number(a.product.inStock);
      }
      return a.product.name.localeCompare(b.product.name);
    });

  // Require real lexical evidence to avoid false matches (e.g., unrelated items).
  return scored[0]?.relevance >= 3 ? scored[0].product : null;
};

export const getKnownBrands = () => {
  const cat = getCatalogSnapshot();
  return [...new Set(cat.map((entry) => entry.brand))];
};


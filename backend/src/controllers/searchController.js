import { searchCatalog } from "../services/searchService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const searchProducts = asyncHandler(async (req, res) => {
  const { query, brand, size, maxPrice, minPrice, inStockOnly } = req.query;

  const rows = searchCatalog({
    query,
    brand,
    size,
    maxPrice,
    minPrice,
    inStockOnly: inStockOnly === "true"
  });

  const qText = [query, brand, size].filter(Boolean).join(" ").trim() || "your query";

  res.json({
    count: rows.length,
    found: rows.length > 0,
    message:
      rows.length > 0
        ? `Found ${rows.length} matching product(s).`
        : `No products found for "${qText}".`,
    results: rows
  });
});


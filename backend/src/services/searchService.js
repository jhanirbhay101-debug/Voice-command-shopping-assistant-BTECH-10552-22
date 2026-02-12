import { filterCatalog } from "./catalogService.js";

export const searchCatalog = (filters = {}) => {
  return filterCatalog(filters).map((row) => ({
    ...row,
    priceLabel: row.onSale && row.salePrice
      ? `$${row.salePrice.toFixed(2)} (sale, was $${row.price.toFixed(2)})`
      : `$${row.price.toFixed(2)}`
  }));
};


import { useMemo, useState } from "react";

const formatCurrency = (value) => `$${value.toFixed(2)}`;
const formatQuantity = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? "");
  return Number(n.toFixed(4)).toString();
};

const SORT_OPTIONS = [
  { value: "name_asc", label: "Name (A-Z)" },
  { value: "name_desc", label: "Name (Z-A)" },
  { value: "brand_asc", label: "Brand (A-Z)" },
  { value: "brand_desc", label: "Brand (Z-A)" },
  { value: "price_low_high", label: "Price (Low-High)" },
  { value: "price_high_low", label: "Price (High-Low)" }
];

const getLinePrice = (item) => {
  const line = Number(item.lineTotalPrice);
  if (Number.isFinite(line) && line > 0) {
    return line;
  }

  const unitPrice = Number(item.lastKnownPrice);
  const qty = Number(item.quantity);

  if (!Number.isFinite(unitPrice) || unitPrice <= 0 || !Number.isFinite(qty) || qty <= 0) {
    return null;
  }

  return unitPrice * qty;
};

export function ListView({ list, onDelete, loading }) {
  const [sortBy, setSortBy] = useState("name_asc");
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");

  const visibleList = useMemo(() => {
    const qText = appliedQ.trim().toLowerCase();
    const items = [...list].filter((entry) => {
      if (!qText) return true;

      const itemName = (entry.name || "").toLowerCase();
      const itemBrand = (entry.brand || "").toLowerCase();
      return itemName.includes(qText) || itemBrand.includes(qText);
    });

    const compareText = (a, b) => a.localeCompare(b);
    const getPrice = (entry) => {
      const line = getLinePrice(entry);
      return line === null ? null : line;
    };

    items.sort((a, b) => {
      if (sortBy === "name_asc") return compareText(a.name || "", b.name || "");
      if (sortBy === "name_desc") return compareText(b.name || "", a.name || "");
      if (sortBy === "brand_asc") return compareText(a.brand || "", b.brand || "");
      if (sortBy === "brand_desc") return compareText(b.brand || "", a.brand || "");
      if (sortBy === "price_low_high" || sortBy === "price_high_low") {
        const aPrice = getPrice(a);
        const bPrice = getPrice(b);
        if (aPrice === null && bPrice === null) return 0;
        if (aPrice === null) return 1;
        if (bPrice === null) return -1;
        return sortBy === "price_low_high" ? aPrice - bPrice : bPrice - aPrice;
      }
      return 0;
    });

    return items;
  }, [list, sortBy, appliedQ]);

  const estimatedTotal = visibleList.reduce((sum, item) => {
    const linePrice = getLinePrice(item);
    return linePrice === null ? sum : sum + linePrice;
  }, 0);

  const hasEstimatedPrices = visibleList.some((item) => getLinePrice(item) !== null);
  const isFiltered = Boolean(appliedQ.trim());

  const onSearch = (event) => {
    event.preventDefault();
    setAppliedQ(q.trim());
  };

  const onQChange = (event) => {
    const next = event.target.value;
    setQ(next);

    if (!next.trim()) {
      setAppliedQ("");
    }
  };

  return (
    <section className="card list-card">
      <div className="section-header">
        <h2>Shopping List</h2>
        <div className="section-header-controls">
          <form className="list-search-form" onSubmit={onSearch}>
            <input
              placeholder="Search item or brand"
              value={q}
              onChange={onQChange}
            />
            <button type="submit" className="secondary" disabled={!q.trim()}>
              Search
            </button>
          </form>
          <label className="sort-control">
            Sort:
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <span>
            {isFiltered ? `${visibleList.length} of ${list.length} items` : `${list.length} items`}
            {hasEstimatedPrices ? ` | Est. Total: ${formatCurrency(estimatedTotal)}` : ""}
          </span>
        </div>
      </div>

      {loading ? <p>Loading list...</p> : null}

      {!loading && !list.length ? <p className="hint">Your list is empty.</p> : null}

      {!loading && list.length && !visibleList.length ? (
        <p className="hint">No matching items found.</p>
      ) : null}

      {!loading && visibleList.length ? (
        <div className="table-wrap list-table-wrap">
          <table className="list-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Brand</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Category</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleList.map((item) => {
                const unitPrice = Number(item.lastKnownPrice);
                const linePrice = getLinePrice(item);
                const billableQuantity = Number(item.billableQuantity);
                const billableUnit = item.billableUnit || "unit";
                const showBreakdown =
                  Number.isFinite(billableQuantity) &&
                  billableQuantity > 0 &&
                  Number.isFinite(unitPrice) &&
                  unitPrice > 0;

                return (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.brand || "Generic"}</td>
                    <td>
                      {item.quantity} {item.unit}
                    </td>
                    <td>
                      {linePrice === null ? (
                        "-"
                      ) : (
                        <>
                          {formatCurrency(linePrice)}
                          {showBreakdown ? (
                            <span className="hint"> ({formatQuantity(billableQuantity)} {billableUnit} x {formatCurrency(unitPrice)})</span>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td>{item.category}</td>
                    <td>{item.inStock ? "In stock" : "Unavailable"}</td>
                    <td>
                      <button className="danger" onClick={() => onDelete(item.id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}


import { useEffect, useState } from "react";

export function SearchPanel({
  onSearch,
  loading,
  results,
  searchAttempted,
  searchTranscript,
  onSearchTranscriptChange,
  searchSpeechSupported,
  isSearchListening,
  onStartSearchMic,
  onStopSearchMic,
  onRunVoiceSearch,
  onClearAllResults,
  onRemoveOneResult,
  onRemoveSelectedResults
}) {
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [size, setSize] = useState("");
  const [max, setMax] = useState("");
  const [min, setMin] = useState("");
  const [inStock, setInStock] = useState(false);
  const [pickedRows, setPickedRows] = useState(new Set());

  useEffect(() => {
    setPickedRows(new Set());
  }, [results]);

  const onSubmit = (event) => {
    event.preventDefault();
    onSearch({ query: q, brand, size, maxPrice: max, minPrice: min, inStockOnly: inStock });
  };

  const toggleRow = (index) => {
    setPickedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const removePicked = () => {
    if (!pickedRows.size) return;
    onRemoveSelectedResults([...pickedRows].sort((a, b) => a - b));
    setPickedRows(new Set());
  };

  return (
    <section className="card search-card">
      <div className="section-header">
        <h2>Voice-Activated Search</h2>
      </div>

      <p className="hint">Use this separate search mic or type a search command below.</p>

      <textarea
        className="transcript-box transcript-input"
        placeholder="Example: Find Colgate toothpaste under 5"
        value={searchTranscript}
        onChange={(event) => onSearchTranscriptChange(event.target.value)}
      />

      {!searchSpeechSupported ? <p className="error">Speech recognition is not supported in this browser.</p> : null}

      <div className="actions-row search-mic-actions">
        <button onClick={onStartSearchMic} disabled={!searchSpeechSupported || isSearchListening}>
          {isSearchListening ? "Listening..." : "Start Search Mic"}
        </button>
        <button className="secondary" onClick={onStopSearchMic} disabled={!isSearchListening}>
          Stop
        </button>
        <button className="accent" onClick={onRunVoiceSearch} disabled={!searchTranscript || loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      <form className="search-form" onSubmit={onSubmit}>
        <input
          placeholder="Item (e.g. organic apples)"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
        <input
          placeholder="Brand"
          value={brand}
          onChange={(event) => setBrand(event.target.value)}
        />
        <input
          placeholder="Size (e.g. 1kg, 150g)"
          value={size}
          onChange={(event) => setSize(event.target.value)}
        />
        <input
          type="number"
          min="0"
          step="0.1"
          placeholder="Max price"
          value={max}
          onChange={(event) => setMax(event.target.value)}
        />
        <input
          type="number"
          min="0"
          step="0.1"
          placeholder="Min price"
          value={min}
          onChange={(event) => setMin(event.target.value)}
        />

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={inStock}
            onChange={(event) => setInStock(event.target.checked)}
          />
          Show only in-stock products
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {results.length ? (
        <>
          <div className="search-actions-row">
            <button className="secondary" onClick={removePicked} disabled={!pickedRows.size}>
              Remove Selected
            </button>
            <button className="danger" onClick={onClearAllResults}>
              Clear All
            </button>
          </div>

          <div className="table-wrap search-table-wrap">
            <table className="list-table search-table">
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Item</th>
                  <th>Brand</th>
                  <th>Size</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item, index) => (
                  <tr key={`${item.name}-${item.brand}-${index}`}>
                    <td>
                      <input
                        type="checkbox"
                        checked={pickedRows.has(index)}
                        onChange={() => toggleRow(index)}
                      />
                    </td>
                    <td>{item.name}</td>
                    <td>{item.brand}</td>
                    <td>{item.size}</td>
                    <td>{item.priceLabel}</td>
                    <td>{item.inStock ? "In stock" : "Unavailable"}</td>
                    <td>
                      <button className="danger" onClick={() => onRemoveOneResult(index)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {!loading && searchAttempted && !results.length ? (
        <p className="hint">No matching items found. Try another item name, brand, size, or price range.</p>
      ) : null}
    </section>
  );
}


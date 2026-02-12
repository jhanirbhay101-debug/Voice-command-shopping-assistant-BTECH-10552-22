const API_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const callApi = async (path, opts = {}) => {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: {
        "Content-Type": "application/json"
      },
      ...opts
    });
  } catch {
    throw new Error(`Cannot connect to backend at ${API_URL}. Make sure backend is running.`);
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }

  return data;
};

export const api = {
  getList: () => callApi("/list"),
  addItem: (body) => callApi("/list/add", { method: "POST", body: JSON.stringify(body) }),
  deleteItem: (id) => callApi(`/list/${id}`, { method: "DELETE" }),
  removeByName: (name) => callApi("/list/remove-by-name", { method: "POST", body: JSON.stringify({ name }) }),
  executeVoice: (body) => callApi("/voice/execute", { method: "POST", body: JSON.stringify(body) }),
  confirmBrandSelection: (body) => callApi("/voice/confirm-brand", { method: "POST", body: JSON.stringify(body) }),
  confirmSubstitute: (body) => callApi("/voice/confirm-substitute", { method: "POST", body: JSON.stringify(body) }),
  parseVoice: (body) => callApi("/voice/parse", { method: "POST", body: JSON.stringify(body) }),
  getSuggestions: (item = "") => callApi(`/suggestions${item ? `?item=${encodeURIComponent(item)}` : ""}`),
  searchProducts: ({ query, brand, size, maxPrice, minPrice, inStockOnly }) => {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (brand) params.set("brand", brand);
    if (size) params.set("size", size);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (minPrice) params.set("minPrice", minPrice);
    if (inStockOnly) params.set("inStockOnly", "true");
    return callApi(`/search?${params.toString()}`);
  }
};


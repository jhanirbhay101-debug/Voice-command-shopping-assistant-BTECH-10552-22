import { useEffect, useMemo, useState } from "react";
import { api } from "./api/client";
import { Header } from "./components/Header";
import { ListView } from "./components/ListView";
import { SearchPanel } from "./components/SearchPanel";
import { SuggestionsPanel } from "./components/SuggestionsPanel";
import { VoiceControl } from "./components/VoiceControl";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";

const formatQuantity = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value ?? "");
  return Number(parsed.toFixed(4)).toString();
};

const formatCurrency = (value) => `$${Number(value).toFixed(2)}`;

function App() {
  const [language, setLanguage] = useState("en-US");
  const [shoppingList, setShoppingList] = useState([]);
  const [suggestionBuckets, setSuggestionBuckets] = useState({
    productRecommendations: [],
    seasonalRecommendations: [],
    substituteRecommendations: []
  });
  const [productSearchResults, setProductSearchResults] = useState([]);
  const [hasSearchedProducts, setHasSearchedProducts] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [lastRecognizedCommand, setLastRecognizedCommand] = useState(null);

  const [pendingBrandSelection, setPendingBrandSelection] = useState(null);
  const [selectedBrandOptionSku, setSelectedBrandOptionSku] = useState("");
  const [brandOptionSort, setBrandOptionSort] = useState("recommended");

  const [pendingSubstituteConfirmation, setPendingSubstituteConfirmation] = useState(null);
  const [selectedSubstituteSku, setSelectedSubstituteSku] = useState("");
  const [substituteSort, setSubstituteSort] = useState("recommended");
  const [substituteSearchText, setSubstituteSearchText] = useState("");
  const [substituteAppliedSearch, setSubstituteAppliedSearch] = useState("");
  const [substituteBrandFilter, setSubstituteBrandFilter] = useState("");

  const [isListLoading, setIsListLoading] = useState(false);
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isBrandSelectionLoading, setIsBrandSelectionLoading] = useState(false);
  const [isSubstituteSelectionLoading, setIsSubstituteSelectionLoading] = useState(false);

  const {
    supported: isVoiceSupported,
    isListening: isVoiceListening,
    transcript: voiceTranscript,
    error: voiceError,
    setTranscript: setVoiceTranscript,
    startListening: startVoiceListening,
    stopListening: stopVoiceListening
  } = useSpeechRecognition({ language });

  const {
    supported: isSearchVoiceSupported,
    isListening: isSearchVoiceListening,
    transcript: searchTranscript,
    error: searchVoiceError,
    setTranscript: setSearchTranscript,
    startListening: startSearchVoiceListening,
    stopListening: stopSearchVoiceListening
  } = useSpeechRecognition({ language });

  const loadShoppingList = async () => {
    try {
      setIsListLoading(true);
      const response = await api.getList();
      setShoppingList(response.list);
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setIsListLoading(false);
    }
  };

  const loadSuggestions = async (focusItem = "") => {
    try {
      setIsSuggestionsLoading(true);
      let response;

      try {
        response = await api.getSuggestions(focusItem);
      } catch {
        response = await api.getSuggestions("");
      }

      setSuggestionBuckets({
        productRecommendations: response.productRecommendations || [],
        seasonalRecommendations: response.seasonalRecommendations || [],
        substituteRecommendations: response.substituteRecommendations || []
      });
    } catch {
      setStatusMessage((current) => current || "Suggestions are temporarily unavailable.");
    } finally {
      setIsSuggestionsLoading(false);
    }
  };

  useEffect(() => {
    loadShoppingList();
    loadSuggestions();
  }, []);

  useEffect(() => {
    if (voiceError) {
      setStatusMessage(`Voice error: ${voiceError}`);
    }
  }, [voiceError]);

  useEffect(() => {
    if (searchVoiceError) {
      setStatusMessage(`Search voice error: ${searchVoiceError}`);
    }
  }, [searchVoiceError]);

  useEffect(() => {
    if (!pendingSubstituteConfirmation) {
      setSelectedSubstituteSku("");
      setSubstituteSort("recommended");
      setSubstituteSearchText("");
      setSubstituteAppliedSearch("");
      setSubstituteBrandFilter("");
      return;
    }

    const options = pendingSubstituteConfirmation.options?.length
      ? pendingSubstituteConfirmation.options
      : pendingSubstituteConfirmation.suggestedAlternative
        ? [pendingSubstituteConfirmation.suggestedAlternative]
        : [];

    const defaultSku =
      pendingSubstituteConfirmation.suggestedAlternative?.sku ||
      options[0]?.sku ||
      "";

    setSelectedSubstituteSku(defaultSku);
    setSubstituteSort("recommended");
    setSubstituteSearchText("");
    setSubstituteAppliedSearch("");
    setSubstituteBrandFilter("");
  }, [pendingSubstituteConfirmation?.token]);

  const runVoiceCommand = async () => {
    try {
      setIsVoiceLoading(true);
      const response = await api.executeVoice({ transcript: voiceTranscript, language });
      setStatusMessage(response.message);
      setLastRecognizedCommand(response.parsed || null);

      if (response.requiresBrandSelection && response.brandSelection) {
        setPendingBrandSelection(response.brandSelection);
        setSelectedBrandOptionSku(response.brandSelection.options?.[0]?.sku || "");
        setBrandOptionSort("recommended");
        setPendingSubstituteConfirmation(null);
        setVoiceTranscript("");
        return;
      }

      if (response.requiresConfirmation && response.confirmation) {
        setPendingSubstituteConfirmation(response.confirmation);
        setPendingBrandSelection(null);
        setSelectedBrandOptionSku("");
        setVoiceTranscript("");
        return;
      }

      setPendingBrandSelection(null);
      setSelectedBrandOptionSku("");
      setPendingSubstituteConfirmation(null);

      if (response.action === "search") {
        setProductSearchResults(response.results || []);
        setHasSearchedProducts(true);
        setVoiceTranscript("");
        return;
      }

      if (response.list) {
        setShoppingList(response.list);
      }

      if (response.parsed?.item) {
        await loadSuggestions(response.parsed.item);
      } else {
        await loadSuggestions();
      }

      setVoiceTranscript("");
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setIsVoiceLoading(false);
    }
  };

  const handleBrandSelection = async (approveSelection) => {
    if (!pendingBrandSelection?.token) {
      return;
    }

    if (approveSelection && !selectedBrandOptionSku) {
      setStatusMessage("Please select a brand option first.");
      return;
    }

    try {
      setIsBrandSelectionLoading(true);
      const response = await api.confirmBrandSelection({
        token: pendingBrandSelection.token,
        cancel: !approveSelection,
        selectedSku: approveSelection ? selectedBrandOptionSku : undefined
      });

      setStatusMessage(response.message);

      if (!approveSelection) {
        setPendingBrandSelection(null);
        setSelectedBrandOptionSku("");
        setBrandOptionSort("recommended");
        return;
      }

      setLastRecognizedCommand(response.parsed || null);
      setPendingBrandSelection(null);
      setSelectedBrandOptionSku("");
      setBrandOptionSort("recommended");

      if (response.requiresConfirmation && response.confirmation) {
        setPendingSubstituteConfirmation(response.confirmation);
        return;
      }

      if (response.list) {
        setShoppingList(response.list);
      }

      if (response.parsed?.item) {
        await loadSuggestions(response.parsed.item);
      } else {
        await loadSuggestions();
      }
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setIsBrandSelectionLoading(false);
    }
  };

  const handleSubstituteSelection = async (approveSelection) => {
    if (!pendingSubstituteConfirmation?.token) {
      return;
    }

    if (
      approveSelection &&
      !selectedSubstituteSku &&
      !pendingSubstituteConfirmation.suggestedAlternative?.sku
    ) {
      setStatusMessage("Please select an alternative option first.");
      return;
    }

    try {
      setIsSubstituteSelectionLoading(true);
      const response = await api.confirmSubstitute({
        token: pendingSubstituteConfirmation.token,
        approve: approveSelection,
        selectedSku: approveSelection
          ? selectedSubstituteSku || pendingSubstituteConfirmation.suggestedAlternative?.sku
          : undefined
      });

      setStatusMessage(response.message);
      if (response.list) {
        setShoppingList(response.list);
      }

      setPendingSubstituteConfirmation(null);
      await loadSuggestions();
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setIsSubstituteSelectionLoading(false);
    }
  };

  const handleRemoveListItem = async (itemId) => {
    try {
      await api.deleteItem(itemId);
      setShoppingList((currentList) => currentList.filter((item) => item.id !== itemId));
      setStatusMessage("Item removed");
      await loadSuggestions();
    } catch (error) {
      setStatusMessage(error.message);
    }
  };

  const handleAddSuggestion = async (itemName) => {
    try {
      const response = await api.addItem({ name: itemName, quantity: 1, unit: "unit" });
      setShoppingList(response.list);
      setStatusMessage(`Added ${itemName} from suggestions`);
      await loadSuggestions(itemName);
    } catch (error) {
      setStatusMessage(error.message);
    }
  };

  const runSearchFilters = async (filters) => {
    try {
      setIsSearchLoading(true);
      const response = await api.searchProducts(filters);
      setProductSearchResults(response.results);
      setHasSearchedProducts(true);
      setStatusMessage(response.message || `${response.count} matching products`);
    } catch (error) {
      setHasSearchedProducts(true);
      setProductSearchResults([]);
      setStatusMessage(error.message);
    } finally {
      setIsSearchLoading(false);
    }
  };

  const runVoiceSearch = async () => {
    if (!searchTranscript.trim()) {
      return;
    }

    try {
      setIsSearchLoading(true);
      const parsed = await api.parseVoice({
        transcript: searchTranscript,
        language
      });

      const filters = {
        query: parsed.filters?.query || parsed.item || searchTranscript,
        brand: parsed.filters?.brand || parsed.brand || "",
        size: parsed.filters?.size || parsed.size || "",
        maxPrice: parsed.filters?.maxPrice ?? "",
        minPrice: parsed.filters?.minPrice ?? "",
        inStockOnly: false
      };

      const response = await api.searchProducts(filters);
      setProductSearchResults(response.results);
      setHasSearchedProducts(true);
      setStatusMessage(response.message || `${response.count} matching products`);
      setLastRecognizedCommand(parsed);
      setSearchTranscript("");
    } catch (error) {
      setHasSearchedProducts(true);
      setProductSearchResults([]);
      setStatusMessage(error.message);
    } finally {
      setIsSearchLoading(false);
    }
  };

  const clearAllSearchResults = () => {
    setProductSearchResults([]);
    setHasSearchedProducts(false);
    setStatusMessage("Cleared all search results");
  };

  const removeSearchResultRow = (rowIndex) => {
    setProductSearchResults((currentRows) =>
      currentRows.filter((_, index) => index !== rowIndex)
    );
  };

  const removeSelectedSearchResults = (indexesToRemove) => {
    const removalSet = new Set(indexesToRemove);
    setProductSearchResults((currentRows) =>
      currentRows.filter((_, index) => !removalSet.has(index))
    );
    setStatusMessage(`Removed ${removalSet.size} selected result(s)`);
  };

  const submitSubstituteSearch = (event) => {
    event.preventDefault();
    setSubstituteAppliedSearch(substituteSearchText.trim());
  };

  const handleSubstituteSearchChange = (event) => {
    const nextValue = event.target.value;
    setSubstituteSearchText(nextValue);
    if (!nextValue.trim()) {
      setSubstituteAppliedSearch("");
    }
  };

  const substituteOptions = useMemo(() => {
    if (!pendingSubstituteConfirmation) return [];
    if (
      Array.isArray(pendingSubstituteConfirmation.options) &&
      pendingSubstituteConfirmation.options.length
    ) {
      return pendingSubstituteConfirmation.options;
    }
    if (pendingSubstituteConfirmation.suggestedAlternative) {
      return [pendingSubstituteConfirmation.suggestedAlternative];
    }
    return [];
  }, [pendingSubstituteConfirmation]);

  useEffect(() => {
    if (!substituteOptions.length) {
      if (selectedSubstituteSku) {
        setSelectedSubstituteSku("");
      }
      return;
    }

    const stillSelected = substituteOptions.some(
      (option) => option.sku === selectedSubstituteSku
    );

    if (!stillSelected) {
      setSelectedSubstituteSku(substituteOptions[0].sku);
    }
  }, [substituteOptions, selectedSubstituteSku]);

  const selectedSubstituteOption = useMemo(() => {
    if (!substituteOptions.length) return null;
    return (
      substituteOptions.find((option) => option.sku === selectedSubstituteSku) ||
      substituteOptions[0]
    );
  }, [substituteOptions, selectedSubstituteSku]);

  const filteredSubstituteOptions = useMemo(() => {
    const searchNeedle = substituteAppliedSearch.trim().toLowerCase();
    const brandNeedle = substituteBrandFilter.trim().toLowerCase();

    const options = [...substituteOptions].filter((option) => {
      const text = `${option.name || ""} ${option.brand || ""}`.toLowerCase();
      const brandText = (option.brand || "").toLowerCase();
      const matchesSearch = !searchNeedle || text.includes(searchNeedle);
      const matchesBrand = !brandNeedle || brandText.includes(brandNeedle);
      return matchesSearch && matchesBrand;
    });

    const compareText = (a, b) => a.localeCompare(b);
    const getOptionPrice = (option) => {
      const linePrice = Number(option.lineTotalPrice);
      if (Number.isFinite(linePrice)) return linePrice;
      const unitPrice = Number(option.unitPrice);
      return Number.isFinite(unitPrice) ? unitPrice : null;
    };

    options.sort((a, b) => {
      if (substituteSort === "recommended") return 0;
      if (substituteSort === "name_asc") return compareText(a.name || "", b.name || "");
      if (substituteSort === "name_desc") return compareText(b.name || "", a.name || "");
      if (substituteSort === "brand_asc") return compareText(a.brand || "", b.brand || "");
      if (substituteSort === "brand_desc") return compareText(b.brand || "", a.brand || "");
      if (substituteSort === "price_low_high" || substituteSort === "price_high_low") {
        const aPrice = getOptionPrice(a);
        const bPrice = getOptionPrice(b);
        if (aPrice === null && bPrice === null) return 0;
        if (aPrice === null) return 1;
        if (bPrice === null) return -1;
        return substituteSort === "price_low_high" ? aPrice - bPrice : bPrice - aPrice;
      }
      return 0;
    });

    return options;
  }, [substituteOptions, substituteAppliedSearch, substituteBrandFilter, substituteSort]);

  const sortedBrandOptions = useMemo(() => {
    const options = [...(pendingBrandSelection?.options || [])];
    const compareText = (a, b) => a.localeCompare(b);

    const getOptionTotal = (option) =>
      Number.isFinite(Number(option.lineTotalPrice))
        ? Number(option.lineTotalPrice)
        : null;

    options.sort((a, b) => {
      if (brandOptionSort === "recommended") return 0;
      if (brandOptionSort === "name_asc") return compareText(a.name || "", b.name || "");
      if (brandOptionSort === "name_desc") return compareText(b.name || "", a.name || "");
      if (brandOptionSort === "brand_asc") return compareText(a.brand || "", b.brand || "");
      if (brandOptionSort === "brand_desc") return compareText(b.brand || "", a.brand || "");
      if (brandOptionSort === "price_low_high" || brandOptionSort === "price_high_low") {
        const aPrice = getOptionTotal(a);
        const bPrice = getOptionTotal(b);
        if (aPrice === null && bPrice === null) return 0;
        if (aPrice === null) return 1;
        if (bPrice === null) return -1;
        return brandOptionSort === "price_low_high" ? aPrice - bPrice : bPrice - aPrice;
      }
      return 0;
    });

    return options;
  }, [pendingBrandSelection, brandOptionSort]);

  return (
    <div className="app-shell">
      <Header actionMessage={statusMessage} />

      <VoiceControl
        language={language}
        onLanguageChange={setLanguage}
        transcript={voiceTranscript}
        onTranscriptChange={setVoiceTranscript}
        isListening={isVoiceListening}
        supported={isVoiceSupported}
        onStart={startVoiceListening}
        onStop={stopVoiceListening}
        onExecute={runVoiceCommand}
        parsed={lastRecognizedCommand}
        loading={isVoiceLoading}
      />

      {pendingBrandSelection ? (
        <section className="card confirm-card">
          <div className="section-header">
            <h2>Select Brand and Price</h2>
          </div>
          <p>
            Multiple options found for <strong>{pendingBrandSelection.requestedItem}</strong>. Select the one you want to add.
          </p>
          <p className="hint">
            Quantity: {pendingBrandSelection.quantity} {pendingBrandSelection.unit}
          </p>

          <label className="sort-control">
            Sort options:
            <select value={brandOptionSort} onChange={(event) => setBrandOptionSort(event.target.value)}>
              <option value="recommended">Recommended</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
              <option value="brand_asc">Brand (A-Z)</option>
              <option value="brand_desc">Brand (Z-A)</option>
              <option value="price_low_high">Price (Low-High)</option>
              <option value="price_high_low">Price (High-Low)</option>
            </select>
          </label>

          <div className="brand-selection-list">
            {sortedBrandOptions.map((option) => (
              <label key={option.sku} className="brand-selection-item">
                <input
                  type="radio"
                  name="brand-selection"
                  checked={selectedBrandOptionSku === option.sku}
                  onChange={() => setSelectedBrandOptionSku(option.sku)}
                />
                <span>
                  <strong>{option.brand}</strong> | {option.name}
                  {option.size ? ` (${option.size})` : ""}
                </span>
                <span className="hint">
                  {option.lineTotalLabel ? `${option.lineTotalLabel} total` : option.unitPriceLabel}
                  {option.billableQuantity
                    ? ` (${formatQuantity(option.billableQuantity)} ${option.billableUnit || "unit"} x ${option.unitPriceLabel})`
                    : ""}
                </span>
              </label>
            ))}
          </div>

          <div className="actions-row">
            <button
              className="accent"
              disabled={isBrandSelectionLoading || !selectedBrandOptionSku}
              onClick={() => handleBrandSelection(true)}
            >
              {isBrandSelectionLoading ? "Processing..." : "Add Selected Option"}
            </button>
            <button
              className="secondary"
              disabled={isBrandSelectionLoading}
              onClick={() => handleBrandSelection(false)}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {pendingSubstituteConfirmation ? (
        <section className="card confirm-card">
          <div className="section-header">
            <h2>Confirm Alternative</h2>
          </div>
          <p>
            Requested: <strong>{pendingSubstituteConfirmation.requestedItem?.name}</strong> (
            {pendingSubstituteConfirmation.requestedItem?.brand || "Generic"})
          </p>
          <p className="hint">
            This item is unavailable. Choose an in-stock alternative to continue.
          </p>
          <p className="hint">
            Quantity: {pendingSubstituteConfirmation.quantity} {pendingSubstituteConfirmation.unit} | Options: {substituteOptions.length}
          </p>

          <div className="confirm-controls-row">
            <form className="inline-search-form" onSubmit={submitSubstituteSearch}>
              <input
                placeholder="Search alternatives by item or brand"
                value={substituteSearchText}
                onChange={handleSubstituteSearchChange}
              />
              <button type="submit" className="secondary" disabled={!substituteSearchText.trim()}>
                Search
              </button>
            </form>

            <input
              className="inline-filter-input"
              placeholder="Filter brand"
              value={substituteBrandFilter}
              onChange={(event) => setSubstituteBrandFilter(event.target.value)}
            />

            <label className="sort-control">
              Sort options:
              <select value={substituteSort} onChange={(event) => setSubstituteSort(event.target.value)}>
                <option value="recommended">Recommended</option>
                <option value="name_asc">Name (A-Z)</option>
                <option value="name_desc">Name (Z-A)</option>
                <option value="brand_asc">Brand (A-Z)</option>
                <option value="brand_desc">Brand (Z-A)</option>
                <option value="price_low_high">Price (Low-High)</option>
                <option value="price_high_low">Price (High-Low)</option>
              </select>
            </label>
          </div>

          <div className="substitute-options-wrap">
            {filteredSubstituteOptions.length ? (
              filteredSubstituteOptions.map((option) => {
                const totalPrice = Number(option.lineTotalPrice);
                const showTotal = Number.isFinite(totalPrice);
                const showBreakdown =
                  Number.isFinite(Number(option.billableQuantity)) &&
                  option.unitPriceLabel &&
                  option.unitPriceLabel !== "-";

                return (
                  <label key={option.sku} className="brand-selection-item substitute-option-item">
                    <input
                      type="radio"
                      name="substitute-selection"
                      checked={selectedSubstituteSku === option.sku}
                      onChange={() => setSelectedSubstituteSku(option.sku)}
                    />
                    <span>
                      <strong>{option.brand || "Generic"}</strong> | {option.name}
                      {option.size ? ` (${option.size})` : ""}
                    </span>
                    <span className="hint">
                      {showTotal ? `${formatCurrency(totalPrice)} total` : option.unitPriceLabel}
                      {showBreakdown
                        ? ` (${formatQuantity(option.billableQuantity)} ${option.billableUnit || "unit"} x ${option.unitPriceLabel})`
                        : ""}
                    </span>
                  </label>
                );
              })
            ) : (
              <p className="hint">No alternatives match the current search/filter.</p>
            )}
          </div>

          {selectedSubstituteOption ? (
            <p className="hint">
              Selected: {selectedSubstituteOption.name} ({selectedSubstituteOption.brand || "Generic"})
            </p>
          ) : null}

          <p className="hint">
            Suggested default: <strong>{pendingSubstituteConfirmation.suggestedAlternative?.name}</strong> (
            {pendingSubstituteConfirmation.suggestedAlternative?.brand || "Generic"})
          </p>
          <div className="actions-row">
            <button
              className="accent"
              disabled={isSubstituteSelectionLoading || !selectedSubstituteOption}
              onClick={() => handleSubstituteSelection(true)}
            >
              {isSubstituteSelectionLoading ? "Processing..." : "OK, Add Alternative"}
            </button>
            <button
              className="secondary"
              disabled={isSubstituteSelectionLoading}
              onClick={() => handleSubstituteSelection(false)}
            >
              No, Thanks
            </button>
          </div>
        </section>
      ) : null}

      <ListView list={shoppingList} onDelete={handleRemoveListItem} loading={isListLoading} />

      <SuggestionsPanel
        productRecommendations={suggestionBuckets.productRecommendations}
        seasonalRecommendations={suggestionBuckets.seasonalRecommendations}
        substituteRecommendations={suggestionBuckets.substituteRecommendations}
        loading={isSuggestionsLoading}
        onApply={handleAddSuggestion}
      />

      <SearchPanel
        onSearch={runSearchFilters}
        loading={isSearchLoading}
        results={productSearchResults}
        searchAttempted={hasSearchedProducts}
        searchTranscript={searchTranscript}
        onSearchTranscriptChange={setSearchTranscript}
        searchSpeechSupported={isSearchVoiceSupported}
        isSearchListening={isSearchVoiceListening}
        onStartSearchMic={startSearchVoiceListening}
        onStopSearchMic={stopSearchVoiceListening}
        onRunVoiceSearch={runVoiceSearch}
        onClearAllResults={clearAllSearchResults}
        onRemoveOneResult={removeSearchResultRow}
        onRemoveSelectedResults={removeSelectedSearchResults}
      />
    </div>
  );
}

export default App;

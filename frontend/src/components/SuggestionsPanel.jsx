const SuggestionList = ({ title, items, emptyText, onApply }) => (
  <section className="suggestion-group">
    <h3>{title}</h3>
    {!items.length ? <p className="hint">{emptyText}</p> : null}
    <ul className="simple-list">
      {items.map((s, i) => (
        <li key={`${title}-${s.type}-${s.item}-${i}`}>
          <span>{s.message}</span>
          <button className="secondary" onClick={() => onApply(s.item)}>
            Add
          </button>
        </li>
      ))}
    </ul>
  </section>
);

export function SuggestionsPanel({
  loading,
  productRecommendations,
  seasonalRecommendations,
  substituteRecommendations,
  onApply
}) {
  return (
    <section className="card suggestions-card">
      <div className="section-header">
        <h2>Smart Suggestions</h2>
      </div>

      {loading ? <p>Loading suggestions...</p> : null}

      {!loading ? (
        <div className="suggestion-scroll">
          <div className="suggestion-groups">
            <SuggestionList
              title="Product Recommendations"
              items={productRecommendations}
              emptyText="No product recommendations right now."
              onApply={onApply}
            />
            <SuggestionList
              title="Seasonal Recommendations"
              items={seasonalRecommendations}
              emptyText="No seasonal recommendations right now."
              onApply={onApply}
            />
            <SuggestionList
              title="Substitute Recommendations"
              items={substituteRecommendations}
              emptyText="No substitute recommendations right now."
              onApply={onApply}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}


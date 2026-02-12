const languages = [
  { label: "English", value: "en-US" },
  { label: "Espanol", value: "es-ES" },
  { label: "Hindi", value: "hi-IN" }
];

const showDebug = import.meta.env.VITE_SHOW_PARSER_DEBUG === "true";

export function VoiceControl({
  language,
  onLanguageChange,
  transcript,
  onTranscriptChange,
  isListening,
  supported,
  onStart,
  onStop,
  onExecute,
  parsed,
  loading
}) {
  return (
    <section className="card voice-card">
      <div className="section-header">
        <h2>Voice Command</h2>
        <select value={language} onChange={(event) => onLanguageChange(event.target.value)}>
          {languages.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      <p className="hint">
        Examples: "I need 5 kg apples", "Remove milk from my list", "Find Colgate toothpaste under 5"
      </p>

      <textarea
        className="transcript-box transcript-input"
        placeholder="Speak a command or type one here..."
        value={transcript}
        onChange={(event) => onTranscriptChange(event.target.value)}
      />

      {!supported ? <p className="error">Speech recognition is not supported in this browser.</p> : null}

      <div className="actions-row">
        <button onClick={onStart} disabled={!supported || isListening}>
          {isListening ? "Listening..." : "Start Mic"}
        </button>
        <button className="secondary" onClick={onStop} disabled={!isListening}>
          Stop
        </button>
        <button className="accent" onClick={onExecute} disabled={!transcript || loading}>
          {loading ? "Processing..." : "Run Command"}
        </button>
      </div>

      {parsed ? (
        <div className="parsed-box">
          <strong>Recognized:</strong>
          {showDebug ? <p>Parser: {parsed.source || "rule"}</p> : null}
          <p>
            Action: {parsed.action} | Item: {parsed.item || "-"} | Brand: {parsed.brand || "-"} | Quantity: {parsed.quantity || "-"} {parsed.unit || ""}
          </p>
          {parsed.action === "search" ? (
            <p>
              Search filters: max ${parsed.filters?.maxPrice ?? "-"}, min ${parsed.filters?.minPrice ?? "-"}, size {parsed.filters?.size || "-"}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}


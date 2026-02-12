export function Header({ actionMessage }) {
  const isErr =
    typeof actionMessage === "string" &&
    /(not found|out of stock|failed|error|cannot|invalid|expired|unavailable)/i.test(actionMessage);

  return (
    <header className="hero">
      <h1>Voice Command Shopping Assistant</h1>
      <p>Manage your shopping list with voice, search filters, and AI-powered suggestions.</p>
      {actionMessage ? <div className={`status ${isErr ? "status-error" : ""}`}>{actionMessage}</div> : null}
    </header>
  );
}


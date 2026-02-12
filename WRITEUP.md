I built a full-stack Voice Command Shopping Assistant using React (frontend) and Node/Express (backend). The frontend uses the Web Speech API, supports `en-US`, `es-ES`, and `hi-IN`, and provides real-time transcript plus parsed-command feedback. The shopping list is displayed in table form with `Item | Brand | Quantity`, and includes category and stock status.

On the backend, voice commands are parsed into structured fields (`action`, `item`, `brand`, `quantity`, `unit`, `size`, and price filters). Parsing now supports a hybrid strategy: Gemini intent parsing when `GEMINI_API_KEY` is configured, with automatic fallback to deterministic rule-based parsing for reliability. This covers add/remove/update/search flows like “I need 5 kg apples,” “Remove milk from my list,” and “Find Colgate toothpaste under 5.”

Smart suggestions combine running-low signals from history, seasonal and on-sale product picks, and substitutes for unavailable or non-preferred items. Search supports voice and form filters by item, brand, size, price range, and stock.

Persistence supports MongoDB Atlas via `MONGODB_URI`, with JSON file fallback for local/demo execution. The code remains modular (routes/controllers/services), includes error handling and loading states, and is deployment-ready.

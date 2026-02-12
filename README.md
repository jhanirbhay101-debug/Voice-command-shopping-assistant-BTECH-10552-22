# Voice Command Shopping Assistant

This project is a full-stack, voice-enabled shopping assistant designed to understand natural, conversational commands. It supports smart intent parsing, intelligent suggestions, and advanced product search filters — all built on a clean React frontend and a scalable Node.js backend.

---

## Tech Stack

- **Frontend:** React + Vite + Web Speech API
- **Backend:** Node.js + Express + Gemini API (optional)
- **Data Storage:** MongoDB Atlas, with a JSON fallback option
- **Product List:** MongoDB-first setup, with a fallback catalog available at `backend/src/data/catalog.large.json`

---

## Features Implemented

### 1. Voice Input

- Voice command recognition directly in the browser
- NLP-style parsing that understands flexible phrases for add, remove, update, and search actions
- Structured extraction from natural speech, including item name, brand, quantity, unit, price filters, and size
- Multilingual command support (`en-US`, `es-ES`, `hi-IN`)

---

### 2. Smart Suggestions

- Product recommendations based on shopping history and the current state of the list (running-low style logic)
- Seasonal recommendations generated for the current month (Gemini-backed with a rule-based fallback), along with on-sale picks
- Substitute recommendations that take availability into account

---

### 3. Shopping List Management

- Add, remove, and modify items using either API calls or voice commands
- Automatic category assignment
- Quantity extraction from natural phrases (for example: `I need 5 kg apples`)
- Tabular list rendering in the format `Item | Brand | Quantity`, including category and status information

---

### 4. Voice-Activated Search

- Dedicated search microphone in the bottom search panel (separate from the main command mic)
- Voice search intent routed directly to product search
- Filters available for query, brand, size, minimum price, maximum price, and in-stock flag
- If a requested item is unavailable, the backend asks for explicit confirmation before adding a substitute
- Search result controls: remove one, remove selected, or clear all

---

### 5. UI / UX

- Minimal, responsive, mobile-first interface
- Real-time transcript display with recognized command feedback
- Clearly separated suggestion sections: Product / Seasonal / Substitute
- Loading states for list data, voice recognition, suggestions, and search results

---

## Run Locally

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

The `.env.example` file is committed as a template. Create a real `.env` file from it and add your actual secrets there.

Optional backend environment variables:

- `MONGODB_URI` – MongoDB Atlas connection string
- `MONGODB_DB_NAME` – Target database name
- `GEMINI_API_KEY` – Gemini API key for intent parsing
- `GEMINI_MODEL` – Model name (default: `gemini-2.5-flash`)
- `DISABLE_GEMINI=true` – Forces rule-based parser even if a key exists
- `SEASONAL_REGION` – Region used for month-aware seasonal recommendations (default: `United States`)

---

### Large Stock Catalog Options

- Generate a large catalog JSON file:`npm run catalog:generate`
- Import generated JSON into MongoDB:`npm run catalog:import:large`
- Import any custom JSON file:
  `npm run catalog:import -- <relative-or-absolute-json-path>`

---

### MongoDB Compass Import

1. Open your target database (`MONGODB_DB_NAME`) and the `catalogitems` collection (create it if needed).
2. Click **Add Data** → **Import JSON or CSV file**.
3. Select `backend/src/data/catalog.large.json`.
4. Choose **JSON Array** format and complete the import.

---

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Optional frontend variable:

- `VITE_SHOW_PARSER_DEBUG=true` – Displays parser source information in the UI (hidden by default)

Local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

---

### Health Endpoint

`GET /api/health`

Returns current runtime status including:

- `parser: gemini+rule-fallback | rule-based`
- `persistence: mongodb | json`
- `catalogSource: mongodb | json`

---

### Substitute Confirmation Flow

- `POST /api/voice/execute` may return `requiresConfirmation: true`
- `POST /api/voice/confirm-substitute` with `{ token, approve }` to accept or reject the suggested alternative

---

## Deployment (Required for Submission)

Current local verification URLs:

- Frontend URL: `http://localhost:5173`
- Backend URL: `http://localhost:5000`
- Health check URL: `http://localhost:5000/api/health`

Before final submission, replace the above URLs with your live deployed links.

Recommended hosting platforms:

- **Backend:** Render / Railway / Fly.io
- **Frontend:** Vercel / Netlify

---

### Production Environment Checklist

- Set backend `CLIENT_URL` to your frontend production domain.
- Set frontend `VITE_API_BASE_URL` to your backend production domain.
- Add `GEMINI_API_KEY` and `MONGODB_URI` on the backend hosting platform (if using AI and MongoDB in production).

---

## Tests

### Backend Smoke Tests

```bash
cd backend
npm run test:smoke
```

### Frontend Smoke Test (Build Verification)

```bash
cd frontend
npm run test
```

---

## Submission ZIP (Exclude Secrets and Build Artifacts)

From the project root, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\create-submission-zip.ps1
```

This generates `voice-shopping-submission.zip` while excluding `.env`, `node_modules`, `dist`, and `.git`.

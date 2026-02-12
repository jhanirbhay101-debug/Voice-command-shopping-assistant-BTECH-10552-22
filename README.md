# Voice Command Shopping Assistant

This project is a full-stack, voice-enabled shopping assistant designed to understand natural and conversational commands. It supports smart sentence parsing, smart suggestions, and advanced  search filters — all built on a clean React frontend and a robust Node.js backend.

---

## Tech Stack

- **Frontend:** React + Vite + Web Speech API
- **Backend:** Node.js + Express + Gemini API
- **Data Storage:** MongoDB Atlas, with a JSON fallback option
- **Product List:** MongoDB-first setup, with a fallback catalog available at `backend/src/data/catalog.large.json`

---

## Features Implemented

### 1. Voice Input

- I have implemented voice command recognition directly in the browser.
- NLP-style parsing that understands flexible phrases for add, remove, update, and search actions
- Structured extraction from natural speech, including item name, brand, quantity, unit, price filters, and size
- Multilingual command support (`en-US`, `es-ES`, `hi-IN`)

---

### 2. Smart Suggestions

- Product recommendations based on shopping history and the current state of the list.
- Seasonal recommendations generated for the current month (Using Gemini), along with on-sale picks
- Substitute recommendations that take availability into account

---

### 3. Shopping List Management

- Add, remove, and modify items using voice commands
- Extracting Quantity from sentance phrases (for example: `I need 5 kg apples`)
- Tabular list rendering in the format `Item | Brand | Quantity`, including category and status information

---

### 4. Voice-Activated Search

- Dedicated search microphone in the bottom search panel in Voice Assissted Search
- Voice search spoken sentance changes directly to product search text.
- Filters available for query, brand, size, minimum price, maximum price, and in-stock conditions.
- If a requested exact item is unavailable, the user will be first asked with alternatives for that item and the user will have to select one to add to the list.
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
npm run dev
```

Backend environment variables:

- `MONGODB_URI` – MongoDB Atlas connection string
- `MONGODB_DB_NAME` – Target database name
- `GEMINI_API_KEY` – Gemini API key for intent parsing
- `GEMINI_MODEL` – Model name (like gemini-2.5-flash)
- `DISABLE_GEMINI=true` – Forces rule-based parser even if a key exists
- `SEASONAL_REGION` – Region used for month-aware seasonal recommendations

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
npm run dev
```

---

## Deployment (Required for Submission)

Current URLs:

- Frontend URL: https://voice-command-shopping-assistant-f5x4.onrender.com/
- Backend URL: https://voice-command-shopping-assistant-btech.onrender.com
- Health check URL: `https://voice-command-shopping-assistant-btech.onrender.com/api/health`

---

### Production Environment Checklist

- Set backend `CLIENT_URL` to your frontend production domain.
- Set frontend `VITE_API_BASE_URL` to your backend production domain.
- Add `GEMINI_API_KEY` and `MONGODB_URI` on the backend hosting platform.

---

## Tests

### Backend Smoke Tests

```bash
cd backend
npm run test:smoke
```

### Frontend Smoke Test

```bash
cd frontend
npm run test
```

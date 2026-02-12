import dotenv from "dotenv";

dotenv.config();

const parseBoolean = (val, def = false) => {
  if (typeof val === "undefined" || val === null || val === "") {
    return def;
  }
  return ["1", "true", "yes", "on"].includes(String(val).toLowerCase());
};

export const env = {
  port: process.env.PORT || 5000,
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  mongoUri: process.env.MONGODB_URI || "",
  mongoDbName: process.env.MONGODB_DB_NAME || "voice-shopping",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  disableGemini: parseBoolean(process.env.DISABLE_GEMINI, false),
  seasonalRegion: process.env.SEASONAL_REGION || "United States"
};



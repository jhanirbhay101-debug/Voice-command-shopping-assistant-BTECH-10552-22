import express from "express";
import cors from "cors";
import morgan from "morgan";
import { env } from "./config/env.js";
import { isMongoConnected } from "./config/database.js";
import { getParserMode } from "./services/nlpService.js";
import { getCatalogSource } from "./services/catalogRepository.js";
import listRoutes from "./routes/listRoutes.js";
import voiceRoutes from "./routes/voiceRoutes.js";
import suggestionRoutes from "./routes/suggestionRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import { errorHandler, notFound } from "./middlewares/errorMiddleware.js";

const app = express();

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }

      const allowSet = new Set([env.clientUrl]);
      const isLocal = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/i.test(origin);

      cb(null, allowSet.has(origin) || isLocal);
    }
  })
);
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    persistence: isMongoConnected() ? "mongodb" : "json",
    parser: getParserMode(),
    catalogSource: getCatalogSource()
  });
});

app.use("/api/list", listRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/suggestions", suggestionRoutes);
app.use("/api/search", searchRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;


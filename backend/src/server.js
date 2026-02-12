import app from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import { refreshCatalogCache } from "./services/catalogRepository.js";

await connectDatabase();
await refreshCatalogCache();

app.listen(env.port, () => {
  console.log(`Backend server running on http://localhost:${env.port}`);
});


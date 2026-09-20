import { app } from "./server.js";
import { env } from "./config/env.js";
import { pool } from "./config/db.js";
import { ensureSchema } from "../scripts/schemaBootstrap.js";
import { seedAdmin } from "../scripts/seedAdmin.js";
import { seedMedicinesIfEmpty } from "../scripts/seedMedicines.js";
import { startNightlyJob } from "../scripts/nightlyJob.js";
await ensureSchema();
await seedAdmin();
try {
  await seedMedicinesIfEmpty();
} catch (e) {
  console.error("[SEED] medicine import failed", e);
}
const server = app.listen(env.port, () =>
  console.log(`[SERVER] listening on ${env.port}`),
);
startNightlyJob();
for (const sig of ["SIGINT", "SIGTERM"])
  process.on(sig, () =>
    server.close(() => pool.end().finally(() => process.exit(0))),
  );

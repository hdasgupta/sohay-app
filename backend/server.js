/** Entry point: bootstrap DB (first run cleans + creates schema, seeds admin), import medicines, start jobs, listen. */
import env from "./src/config/env.js";
import { createApp } from "./src/app.js";
import { bootstrapDatabase } from "./src/db/init.js";
import { ensureMedicines } from "./src/services/medicine.service.js";
import {
  startAppointmentStatusJob,
  stopAppointmentStatusJob,
} from "./src/jobs/appointmentStatus.job.js";
import { pool } from "./src/config/db.js";
import logger from "./src/utils/logger.js";

async function main() {
  logger.info(`Starting API in ${env.nodeEnv} mode (TZ=${process.env.TZ})`);
  await bootstrapDatabase();
  const app = createApp();
  const server = app.listen(env.port, () =>
    logger.info(
      `API listening on port ${env.port}; frontend ${env.frontendUrl}`,
    ),
  );
  if (env.medicineImportOnStart) ensureMedicines(); // runs in background
  if (env.enableCron) startAppointmentStatusJob();

  const shutdown = (signal) => {
    logger.warn(`${signal} received - shutting down`);
    stopAppointmentStatusJob();
    server.close(() => pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

process.on("unhandledRejection", (err) =>
  logger.error("Unhandled rejection", err),
);
main().catch((err) => {
  logger.error("Fatal startup error", err);
  process.exit(1);
});

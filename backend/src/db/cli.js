/** CLI: node src/db/cli.js <reset|init|medicines|status|cleanup-test-data [domain]> */
import "../config/env.js";
import { bootstrapDatabase, isInitialised } from "./init.js";
import {
  ensureMedicines,
  medicineCount,
} from "../services/medicine.service.js";
import { pool } from "../config/db.js";
import logger from "../utils/logger.js";
import { SYSTEM_SQL } from "../scripts/system.sql.js";
import { deletePrescription } from "../services/storage.service.js";

const cmd = process.argv[2] || "init";
try {
  if (cmd === "reset") {
    await bootstrapDatabase({ force: true });
    logger.info("Database reset complete");
  } else if (cmd === "init") {
    const r = await bootstrapDatabase();
    logger.info(
      r.freshlyCreated ? "Database created" : "Database already initialised",
    );
  } else if (cmd === "medicines") {
    await ensureMedicines();
  } else if (cmd === "status") {
    const ready = await isInitialised();
    console.log(
      JSON.stringify({
        initialised: ready,
        medicines: ready ? await medicineCount() : 0,
      }),
    );
  } else if (cmd === "cleanup-test-data") {
    const pattern = `%@${process.argv[3] || "autotest.wbfmh.local"}`;
    const { rows } = await pool.query(SYSTEM_SQL.TEST_PRESCRIPTION_KEYS, [
      pattern,
    ]);
    const keys = [...new Set(rows.map((r) => r.pdf_key))];
    for (const key of keys) {
      try {
        await deletePrescription(key);
      } catch (e) {
        logger.warn(`Could not delete ${key}: ${e.message}`);
      }
    }
    const users = await pool.query(SYSTEM_SQL.TEST_USERS_DELETE, [pattern]);
    await pool.query(SYSTEM_SQL.TEST_OTPS_DELETE, [pattern]);
    logger.info(
      `Test cleanup: ${users.rowCount} user(s), ${keys.length} prescription file(s) removed`,
    );
  } else {
    console.error(`Unknown command ${cmd}`);
    process.exitCode = 1;
  }
} catch (err) {
  console.error("DB command failed:", err);
  process.exitCode = 1;
} finally {
  await pool.end();
}

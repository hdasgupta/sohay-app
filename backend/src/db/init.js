/**
 * Database bootstrap: rebuilds the schema (drop if exists -> create),
 * seeds the default admin and imports the medicine master data.
 *
 * Run explicitly:  npm run db:init
 * It is also invoked automatically on the first successful server boot
 * (see src/db/bootstrap.js).
 */
import { pool, query, queryOne } from '../config/db.js';
import { SCHEMA_STEPS } from '../scripts/schema.sql.js';
import { seedAdmin } from './seedAdmin.js';
import { bootstrapMedicines } from '../services/medicineService.js';
import { ensureBucket } from '../utils/s3.js';

export const rebuildSchema = async () => {
  for (const step of SCHEMA_STEPS) {
    console.log(`[db:init] ${step.label}`);
    await query(step.sql, []);
  }
  console.log('[db:init] schema is ready');
};

export const runFullInit = async () => {
  await rebuildSchema();
  await seedAdmin();
  await bootstrapMedicines();
  await ensureBucket();
};

const isDirectRun = process.argv[1] && process.argv[1].endsWith('init.js');
if (isDirectRun) {
  runFullInit()
    .then(async () => {
      const row = await queryOne('SELECT COUNT(*)::INT AS total FROM medicines', []);
      console.log(`[db:init] finished. medicines=${row.total}`);
      await pool.end();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('[db:init] FAILED:', error);
      await pool.end();
      process.exit(1);
    });
}

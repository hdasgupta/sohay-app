import { query, queryOne } from '../config/db.js';
import { rebuildSchema } from './init.js';
import { seedAdmin } from './seedAdmin.js';
import { bootstrapMedicines } from '../services/medicineService.js';
import { ensureBucket } from '../utils/s3.js';

const TABLE_NAME = 'users';
const SCHEMA_NAME = 'public';

const CHECK_USERS_TABLE = `
  SELECT COUNT(*)::INT AS total
  FROM information_schema.tables
  WHERE table_schema = $1
    AND table_name = $2
`;

/**
 * First-run bootstrap executed while the server starts:
 *  - creates the schema when it is missing,
 *  - seeds the default admin user,
 *  - fills the medicine table from the public csv when it is empty,
 *  - makes sure the prescription bucket exists.
 */
export const bootstrapOnStartup = async () => {
  try {
    const row = await queryOne(CHECK_USERS_TABLE, [SCHEMA_NAME, TABLE_NAME]);
    if (Number(row.total) === 0) {
      console.log('[bootstrap] first run detected, creating schema');
      await rebuildSchema();
    } else {
      console.log('[bootstrap] schema already present');
    }
    await seedAdmin();
    await bootstrapMedicines();
    await ensureBucket();
    await query('SELECT 1', []);
    console.log('[bootstrap] startup bootstrap completed');
  } catch (error) {
    console.error('[bootstrap] startup bootstrap failed:', error.message);
  }
};

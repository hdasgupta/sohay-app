import axios from 'axios';
import { parse } from 'csv-parse/sync';
import { env } from '../config/env.js';
import { query, queryOne } from '../config/db.js';
import { COUNT_MEDICINES, INSERT_MEDICINES_BULK } from '../scripts/common.sql.js';

const MIN_NAME_LENGTH = 2;
const CHUNK_SIZE = 2000;

/**
 * Runs once while the server boots. If the medicine table is empty the Indian
 * medicine dataset csv is downloaded; the header row is skipped and only the
 * second column (name) is stored.
 */
export const bootstrapMedicines = async () => {
  const countRow = await queryOne(COUNT_MEDICINES, []);
  if (Number(countRow.total) > 0) {
    console.log(`[medicine] table already holds ${countRow.total} rows, skipping import`);
    return { imported: 0, skipped: true };
  }

  console.log(`[medicine] table empty, downloading ${env.medicine.csvUrl}`);
  const response = await axios.get(env.medicine.csvUrl, { responseType: 'text', timeout: 180000 });
  const records = parse(response.data, { relax_column_count: true, skip_empty_lines: true });

  // skip the header row, keep the second column only
  const names = records
    .slice(1)
    .map((row) => (row.length > 1 ? String(row[1]).trim() : ''))
    .filter((name) => name.length >= MIN_NAME_LENGTH)
    .slice(0, env.medicine.importLimit);

  const unique = [...new Set(names)];
  let imported = 0;
  for (let index = 0; index < unique.length; index += CHUNK_SIZE) {
    const chunk = unique.slice(index, index + CHUNK_SIZE);
    await query(INSERT_MEDICINES_BULK, [chunk, MIN_NAME_LENGTH - 1]);
    imported += chunk.length;
    console.log(`[medicine] imported ${imported}/${unique.length}`);
  }

  console.log(`[medicine] import finished, ${imported} candidate names processed`);
  return { imported, skipped: false };
};

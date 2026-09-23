/**
 * Medicine master import. When the medicines table is empty, the Indian medicine CSV is
 * streamed from GitHub; the header row is skipped and only the 2nd column (name) is stored.
 */
import axios from 'axios';
import { parse } from 'csv-parse';
import { query } from '../config/db.js';
import { SYSTEM_SQL } from '../scripts/system.sql.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import { META_KEYS } from '../config/constants.js';

const BATCH = 5000;
let running = null;

export async function medicineCount() {
  const { rows } = await query(SYSTEM_SQL.MEDICINE_COUNT);
  return rows[0].total;
}

async function insertBatch(names) {
  if (!names.length) return;
  await query(SYSTEM_SQL.MEDICINE_INSERT_BATCH, [names]);
}

/** Import from a CSV stream or URL. Returns number of rows read. */
export async function importMedicinesFromStream(stream) {
  const parser = stream.pipe(parse({ from_line: 2, relax_column_count: true, relax_quotes: true, skip_empty_lines: true, bom: true }));
  let batch = [];
  let read = 0;
  for await (const record of parser) {
    const name = String(record[1] || '').trim().replace(/\s+/g, ' ').slice(0, 255);
    if (!name) continue;
    batch.push(name);
    read += 1;
    if (batch.length >= BATCH) {
      await insertBatch(batch);
      batch = [];
      if (read % 50000 === 0) logger.info(`Medicines imported so far: ${read}`);
    }
  }
  await insertBatch(batch);
  return read;
}

export function ensureMedicines() {
  if (running) return running;
  running = (async () => {
    try {
      const count = await medicineCount();
      if (count > 0) {
        logger.info(`Medicine table already has ${count} rows - skipping import`);
        return count;
      }
      logger.info(`Medicine table empty - downloading ${env.medicineCsvUrl}`);
      const res = await axios.get(env.medicineCsvUrl, { responseType: 'stream', timeout: 120000 });
      const read = await importMedicinesFromStream(res.data);
      const total = await medicineCount();
      await query(SYSTEM_SQL.META_UPSERT, [META_KEYS.MEDICINES_IMPORTED, String(total)]);
      logger.info(`Medicine import finished: read ${read} rows, ${total} unique medicines stored`);
      return total;
    } catch (err) {
      logger.error('Medicine import failed:', err.message);
      return 0;
    } finally {
      running = null;
    }
  })();
  return running;
}

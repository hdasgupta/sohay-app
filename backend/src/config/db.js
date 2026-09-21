import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

/**
 * Neon connection strings carry `sslmode` / `channel_binding` parameters. The
 * driver warns that those aliases change meaning in its next major version, so
 * they are removed here and TLS is configured explicitly instead.
 */
const normalizeConnectionString = (value) => {
  try {
    const url = new URL(value);
    ['sslmode', 'channel_binding'].forEach((key) => url.searchParams.delete(key));
    return url.toString();
  } catch (error) {
    console.warn('[db] could not normalise the database url, using it unchanged:', error.message);
    return value;
  }
};

export const pool = new Pool({
  connectionString: normalizeConnectionString(env.databaseUrl),
  ssl: env.pgSsl ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

pool.on('error', (error) => {
  console.error('[db] idle client error:', error.message);
});

/**
 * Run a parameterized query. Every literal value MUST arrive through `params`.
 */
export const query = async (text, params = []) => {
  const startedAt = Date.now();
  try {
    const result = await pool.query(text, params);
    console.log(`[db] ok rows=${result.rowCount} in ${Date.now() - startedAt}ms :: ${oneLine(text)}`);
    return result;
  } catch (error) {
    console.error(`[db] FAILED :: ${oneLine(text)} :: ${error.message}`);
    throw error;
  }
};

export const queryOne = async (text, params = []) => {
  const result = await query(text, params);
  return result.rows[0] || null;
};

/** Run several statements inside a single transaction. */
export const withTransaction = async (handler) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    console.log('[db] transaction committed');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[db] transaction rolled back:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

export const healthCheck = async () => {
  const row = await queryOne('SELECT NOW() AS now');
  return row?.now || null;
};

const oneLine = (text) => String(text).replace(/\s+/g, ' ').trim().slice(0, 140);

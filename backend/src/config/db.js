import pg from 'pg';
import env from './env.js';
import logger from '../utils/logger.js';
import { TRANSACTION_SQL } from '../scripts/transaction.sql.js';

// Keep DATE / TIME / TIMESTAMP (without tz) as plain strings - no implicit timezone shifting.
pg.types.setTypeParser(1082, (v) => v); // date        -> 'YYYY-MM-DD'
pg.types.setTypeParser(1083, (v) => v); // time        -> 'HH:MM:SS'
pg.types.setTypeParser(1114, (v) => v); // timestamp   -> string
pg.types.setTypeParser(20, (v) => parseInt(v, 10)); // bigint/count -> number

function buildConfig() {
  const url = new URL(env.databaseUrl);
  // pg does not understand channel_binding in the URL; it negotiates SCRAM-SHA-256-PLUS itself.
  const channelBinding = url.searchParams.get('channel_binding');
  url.searchParams.delete('channel_binding');
  const sslmode = url.searchParams.get('sslmode');
  url.searchParams.delete('sslmode');
  const useSsl = env.dbSsl || sslmode === 'require';
  return {
    connectionString: url.toString(),
    ssl: useSsl ? { rejectUnauthorized: true } : false,
    max: env.dbPoolMax,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000,
    keepAlive: true,
    enableChannelBinding: channelBinding === 'require',
  };
}

export const pool = new pg.Pool(buildConfig());
pool.on('error', (err) => logger.error('Unexpected PostgreSQL pool error', err.message));

/** Run a parameterised query. */
export async function query(text, params = []) {
  const started = Date.now();
  try {
    const result = await pool.query(text, params);
    const ms = Date.now() - started;
    if (ms > 1500) logger.warn(`Slow query (${ms} ms): ${text.split('\n')[0].slice(0, 120)}`);
    return result;
  } catch (err) {
    logger.error('Query failed:', err.message, '|', text.replace(/\s+/g, ' ').slice(0, 160));
    throw err;
  }
}

/** Run callback inside a transaction; callback receives a client with .query */
export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query(TRANSACTION_SQL.BEGIN);
    const out = await callback(client);
    await client.query(TRANSACTION_SQL.COMMIT);
    return out;
  } catch (err) {
    await client.query(TRANSACTION_SQL.ROLLBACK).catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export default { pool, query, withTransaction };

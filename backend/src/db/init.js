/**
 * Database bootstrap.
 * First run (no app_meta table / schema version) -> the database is cleaned fully and recreated
 * from scripts/schema.sql, lookup values are seeded and the default admin is created.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { pool, query, withTransaction } from "../config/db.js";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import { SYSTEM_SQL } from "../scripts/system.sql.js";
import { COMMON_SQL } from "../scripts/common.sql.js";
import { ADMIN_SQL } from "../scripts/admin.sql.js";
import { hashPassword } from "../utils/password.js";
import {
  ROLES,
  APPOINTMENT_STATUS,
  INVITATION_STATUS,
  FOOD_TIMING,
  FOOD_TIMING_LABEL,
  META_KEYS,
  SCHEMA_VERSION,
} from "../config/constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_FILE = path.resolve(__dirname, "../scripts/schema.sql");
const PUBLIC_SCHEMA = "public";

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");

export async function isInitialised() {
  const { rows } = await query(SYSTEM_SQL.TABLE_EXISTS, [
    `${PUBLIC_SCHEMA}.app_meta`,
  ]);
  if (!rows[0].table_name) return false;
  const meta = await query(SYSTEM_SQL.META_GET, [META_KEYS.SCHEMA_VERSION]);
  return meta.rows.length > 0 && meta.rows[0].meta_value === SCHEMA_VERSION;
}

/** Fallback cleaner used only if DROP SCHEMA is not permitted for the role */
async function dropObjectsIndividually(client) {
  const { rows: tables } = await client.query(SYSTEM_SQL.LIST_SCHEMA_TABLES, [
    PUBLIC_SCHEMA,
  ]);
  for (const t of tables)
    await client.query(
      SYSTEM_SQL.DROP_TABLE_CASCADE(pg.escapeIdentifier(t.tablename)),
    );
  const { rows: types } = await client.query(SYSTEM_SQL.LIST_SCHEMA_TYPES, [
    PUBLIC_SCHEMA,
    ["e", "c", "d"],
  ]);
  for (const t of types)
    await client.query(
      SYSTEM_SQL.DROP_TYPE_CASCADE(pg.escapeIdentifier(t.typname)),
    );
}

/** Clean the database fully and create all tables / indexes */
export async function resetSchema() {
  const sql = fs.readFileSync(SCHEMA_FILE, "utf8");
  const client = await pool.connect();
  try {
    logger.warn(
      "Cleaning database (dropping all tables, indexes, types, extensions) and creating schema...",
    );
    try {
      await client.query(sql);
    } catch (err) {
      logger.warn(
        `Full schema drop failed (${err.message}); dropping objects individually`,
      );
      await dropObjectsIndividually(client);
      const withoutSchemaDrop = sql
        .split("\n")
        .filter(
          (l) =>
            !/^(DROP SCHEMA|CREATE SCHEMA|GRANT ALL ON SCHEMA)/i.test(l.trim()),
        )
        .join("\n");
      await client.query(withoutSchemaDrop);
    }
  } finally {
    client.release();
  }
  logger.info("Schema created");
}

export async function seedLookups() {
  const roles = Object.values(ROLES);
  const statuses = Object.values(APPOINTMENT_STATUS);
  const invitation = Object.values(INVITATION_STATUS);
  const food = Object.values(FOOD_TIMING);
  await query(SYSTEM_SQL.SEED_USER_ROLES, [roles, roles.map(cap)]);
  await query(SYSTEM_SQL.SEED_APPOINTMENT_STATUSES, [
    statuses,
    statuses.map(cap),
  ]);
  await query(SYSTEM_SQL.SEED_INVITATION_STATUSES, [
    invitation,
    invitation.map(cap),
  ]);
  await query(SYSTEM_SQL.SEED_FOOD_TIMINGS, [
    food,
    food.map((f) => FOOD_TIMING_LABEL[f]),
  ]);
}

export async function ensureAdmin() {
  const { rows } = await query(COMMON_SQL.USER_FIND_BY_EMAIL, [
    env.admin.email,
  ]);
  if (rows.length) return rows[0];
  const hash = await hashPassword(env.admin.password);
  const admin = await withTransaction(async (client) => {
    const { rows: created } = await client.query(COMMON_SQL.USER_INSERT, [
      env.admin.name,
      env.admin.email,
      hash,
      ROLES.ADMIN,
    ]);
    await client.query(ADMIN_SQL.ADMIN_INSERT, [created[0].id]);
    return created[0];
  });
  logger.info(`Default admin created: ${env.admin.email}`);
  return admin;
}

/** Idempotent bootstrap executed on every server start */
export async function bootstrapDatabase({ force = false } = {}) {
  const initialised = !force && (await isInitialised());
  if (!initialised) {
    await resetSchema();
    await seedLookups();
    await query(SYSTEM_SQL.META_UPSERT, [
      META_KEYS.SCHEMA_VERSION,
      SCHEMA_VERSION,
    ]);
  } else {
    logger.info("Database schema already initialised");
    await seedLookups();
  }
  await ensureAdmin();
  return { freshlyCreated: !initialised };
}

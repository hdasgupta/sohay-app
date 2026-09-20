import { queryOne, withTransaction } from '../config/db.js';
import { env } from '../config/env.js';
import { COUNT_USERS_BY_EMAIL, INSERT_ADMIN, INSERT_USER } from '../scripts/common.sql.js';
import { hashPassword } from '../utils/password.js';
import { ROLES } from '../middleware/auth.js';

const NOT_DISABLED = false;

/** Creates wbffmh@gmail.com / Admin@12345 when it does not exist yet. */
export const seedAdmin = async () => {
  const existing = await queryOne(COUNT_USERS_BY_EMAIL, [env.seedAdmin.email]);
  if (Number(existing.total) > 0) {
    console.log(`[seed] admin ${env.seedAdmin.email} already present`);
    return false;
  }
  const passwordHash = await hashPassword(env.seedAdmin.password);
  await withTransaction(async (client) => {
    const result = await client.query(INSERT_USER, [
      env.seedAdmin.name,
      env.seedAdmin.email,
      passwordHash,
      ROLES.ADMIN,
      NOT_DISABLED,
    ]);
    await client.query(INSERT_ADMIN, [result.rows[0].id]);
  });
  console.log(`[seed] admin created: ${env.seedAdmin.email}`);
  return true;
};

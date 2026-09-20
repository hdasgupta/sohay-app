import fs from 'node:fs/promises'; import path from 'node:path'; import {pool} from '../src/config/db.js';
const schema=await fs.readFile(path.join(process.cwd(),'scripts/sql/schema.sql'),'utf8'); export async function ensureSchema(){await pool.query(schema);console.log('[DB] schema ready')}

import pg from 'pg'; import {env} from './env.js';
const {Pool}=pg;
export const pool=new Pool({connectionString:env.databaseUrl,max:10,idleTimeoutMillis:30000,connectionTimeoutMillis:10000,ssl:{rejectUnauthorized:false}});
pool.on('error',e=>console.error('[DB] idle client error',e));

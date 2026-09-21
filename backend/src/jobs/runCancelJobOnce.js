import { pool } from '../config/db.js';
import { cancelPastAppointments } from './cancelPastAppointments.js';

cancelPastAppointments()
  .then(async (count) => {
    console.log(`[job] manual run finished, ${count} appointment(s) cancelled`);
    await pool.end();
  })
  .catch(async (error) => {
    console.error('[job] manual run failed:', error.message);
    await pool.end();
    process.exit(1);
  });

/** Daily midnight (Asia/Kolkata) job: past scheduled / rescheduled appointments -> cancelled. */
import cron from 'node-cron';
import { query } from '../config/db.js';
import { SYSTEM_SQL } from '../scripts/system.sql.js';
import { APPOINTMENT_STATUS, ACTIVE_APPOINTMENT_STATUSES } from '../config/constants.js';
import { todayInKolkata } from '../utils/date.js';
import logger from '../utils/logger.js';

export async function cancelPastAppointments(today = todayInKolkata()) {
  const { rows } = await query(SYSTEM_SQL.CANCEL_PAST_APPOINTMENTS, [APPOINTMENT_STATUS.CANCELLED, ACTIVE_APPOINTMENT_STATUSES, today]);
  await query(SYSTEM_SQL.PURGE_EXPIRED_CAPTCHAS);
  await query(SYSTEM_SQL.PURGE_OLD_OTPS, [1]);
  logger.info(`Midnight job: ${rows.length} past appointment(s) marked cancelled`);
  return rows.length;
}

let task = null;
export function startAppointmentStatusJob() {
  if (task) return task;
  task = cron.schedule('0 0 * * *', () => {
    cancelPastAppointments().catch((err) => logger.error('Midnight job failed', err.message));
  }, { timezone: 'Asia/Kolkata', name: 'cancel-past-appointments' });
  logger.info('Scheduled daily midnight (Asia/Kolkata) appointment status job');
  // catch up immediately in case the server was asleep at midnight (e.g. Render free tier)
  cancelPastAppointments().catch((err) => logger.error('Startup catch-up job failed', err.message));
  return task;
}
export function stopAppointmentStatusJob() { if (task) { task.stop(); task = null; } }

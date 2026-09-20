import cron from 'node-cron';
import { query } from '../config/db.js';
import { UPDATE_PAST_APPOINTMENTS_TO_CANCELLED } from '../scripts/appointment.sql.js';
import { ACTIVE_STATUSES } from '../services/slotService.js';
import { nowTime, todayISO } from '../utils/dates.js';
import { env } from '../config/env.js';

const STATUS_CANCELLED = 'CANCELLED';

/** Flip every past SCHEDULED / RESCHEDULED appointment to CANCELLED. */
export const cancelPastAppointments = async () => {
  const result = await query(UPDATE_PAST_APPOINTMENTS_TO_CANCELLED, [
    STATUS_CANCELLED,
    ACTIVE_STATUSES,
    todayISO(),
    nowTime(),
  ]);
  console.log(`[job] auto-cancelled ${result.rowCount} past appointment(s)`);
  return result.rowCount;
};

export const scheduleCancelJob = () => {
  cron.schedule(env.jobs.cancelCron, () => {
    console.log('[job] midnight auto-cancel job triggered');
    cancelPastAppointments().catch((error) => console.error('[job] auto-cancel failed:', error.message));
  }, { timezone: env.jobs.timezone });
  console.log(`[job] auto-cancel scheduled (${env.jobs.cancelCron} ${env.jobs.timezone})`);
};

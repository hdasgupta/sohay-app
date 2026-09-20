import { pool } from "../src/config/db.js";
import { cancelPastAppointments } from "./sql/jobQueries.js";
async function cleanup() {
  try {
    const r = await pool.query(cancelPastAppointments, [
      "cancelled",
      "scheduled",
      "rescheduled",
    ]);
    if (r.rowCount)
      console.log("[JOB] cancelled past appointments", r.rowCount);
  } catch (e) {
    console.error("[JOB]", e);
  }
}
export function startNightlyJob() {
  let lastRun = "";
  const tick = async () => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
    const key = `${p.year}-${p.month}-${p.day}`;
    if (p.hour === "00" && p.minute === "00" && lastRun !== key) {
      lastRun = key;
      await cleanup();
    }
    setTimeout(tick, 30000);
  };
  tick();
}

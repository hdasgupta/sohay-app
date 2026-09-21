import { createApp } from './src/app.js';
import { env } from './src/config/env.js';
import { bootstrapOnStartup } from './src/db/bootstrap.js';
import { scheduleCancelJob } from './src/jobs/cancelPastAppointments.js';
import { pool } from './src/config/db.js';

const app = createApp();

const server = app.listen(env.port, async () => {
  console.log(`[server] listening on port ${env.port} (${env.nodeEnv})`);
  console.log(`[server] frontend url: ${env.frontendUrl}`);
  await bootstrapOnStartup();
  scheduleCancelJob();
});

const shutdown = async (signal) => {
  console.log(`[server] ${signal} received, shutting down`);
  server.close(async () => {
    await pool.end();
    console.log('[server] closed cleanly');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => console.error('[server] unhandled rejection:', reason));
process.on('uncaughtException', (error) => console.error('[server] uncaught exception:', error));

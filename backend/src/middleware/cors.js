/** CORS configured so the Vercel frontend (and local dev) never hit permission issues. */
import cors from "cors";
import env from "../config/env.js";
import logger from "../utils/logger.js";

const allowed = new Set(
  [env.frontendUrl, ...env.corsOrigins].map((o) => o.replace(/\/+$/, "")),
);
const allowAll = env.corsOrigins.includes("*");

export const corsMiddleware = cors({
  origin(origin, cb) {
    if (!origin || allowAll || allowed.has(origin)) return cb(null, true);
    if (
      env.corsAllowVercelPreviews &&
      /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)
    )
      return cb(null, true);
    if (
      !env.isProduction &&
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    )
      return cb(null, true);
    logger.warn(`CORS blocked origin ${origin}`);
    return cb(null, false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-Client-Timezone",
  ],
  exposedHeaders: ["Content-Disposition"],
  credentials: false,
  maxAge: 86400,
});

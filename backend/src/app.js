import express from "express";
import helmet from "helmet";
import { corsMiddleware } from "./middleware/cors.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { notFound, errorHandler } from "./middleware/error.js";
import apiRoutes from "./routes/index.js";
import webhookRoutes from "./routes/webhook.routes.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1); // Render / Vercel proxies
  app.disable("x-powered-by");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(corsMiddleware);
  app.options(/.*/, corsMiddleware);
  app.use(requestLogger);
  app.use("/api/webhooks", webhookRoutes); // before json parser (needs raw body)
  app.use(express.json({ limit: "2mb" }));
  app.use("/api", apiLimiter, apiRoutes);
  app.get("/", (_req, res) =>
    res.json({
      success: true,
      message: "West Bengal Forum for Mental Health - Appointment API",
    }),
  );
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export default createApp;

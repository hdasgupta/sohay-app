import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { env } from './config/env.js';

export const createApp = () => {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: false }));

  /**
   * CORS is deliberately permissive for the API so the Vercel frontend never
   * hits a permission problem. Auth is carried by the Bearer token, not cookies.
   */
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (env.corsOrigins.length === 0 || env.corsOrigins.includes(origin) || origin === env.frontendUrl) {
          return callback(null, true);
        }
        console.warn(`[cors] allowing unlisted origin ${origin}`);
        return callback(null, true);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-webhook-secret'],
    }),
  );
  /**
   * No explicit app.options('*') route here on purpose: the cors() middleware
   * above already answers preflight requests, and a bare '*' path is rejected
   * by path-to-regexp v8 (express 5 / router 2), which throws
   * "Missing parameter name at index 1" at startup.
   */

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(requestLogger);

  app.get('/', (req, res) => {
    res.json({ success: true, message: `${env.org.name} appointment API is running` });
  });

  app.use('/api', routes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

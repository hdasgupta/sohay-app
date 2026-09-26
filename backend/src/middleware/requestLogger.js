import morgan from "morgan";
import env from "../config/env.js";

export const requestLogger = env.isTest
  ? (_req, _res, next) => next()
  : morgan(env.isProduction ? "combined" : "dev");

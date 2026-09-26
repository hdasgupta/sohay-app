/** Tiny structured logger - every line is stamped with Asia/Kolkata time. */
const stamp = () =>
  new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: false,
  });
const silent = process.env.NODE_ENV === "test" && !process.env.LOG_IN_TEST;
const logger = {
  info: (...a) => {
    if (!silent) console.log(`[${stamp()}] [INFO]`, ...a);
  },
  warn: (...a) => {
    if (!silent) console.warn(`[${stamp()}] [WARN]`, ...a);
  },
  error: (...a) => {
    if (!silent) console.error(`[${stamp()}] [ERROR]`, ...a);
  },
  debug: (...a) => {
    if (!silent && process.env.NODE_ENV !== "production")
      console.log(`[${stamp()}] [DEBUG]`, ...a);
  },
};
export default logger;

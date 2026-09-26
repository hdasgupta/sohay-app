/** Console logger used across the app for critical states */
const PREFIX = "[WBFMH]";
const logger = {
  info: (...a) => console.log(PREFIX, ...a),
  warn: (...a) => console.warn(PREFIX, ...a),
  error: (...a) => console.error(PREFIX, ...a),
};
export default logger;

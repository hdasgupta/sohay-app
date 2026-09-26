/** Operational error with an HTTP status that is safe to show to the user. */
export default class AppError extends Error {
  constructor(message, status = 400, details = undefined) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.details = details;
  }
  static badRequest(msg, details) {
    return new AppError(msg, 400, details);
  }
  static unauthorized(msg = "Please login to continue") {
    return new AppError(msg, 401);
  }
  static forbidden(msg = "You are not allowed to perform this action") {
    return new AppError(msg, 403);
  }
  static notFound(msg = "Resource not found") {
    return new AppError(msg, 404);
  }
  static conflict(msg) {
    return new AppError(msg, 409);
  }
  static tooMany(msg) {
    return new AppError(msg, 429);
  }
}

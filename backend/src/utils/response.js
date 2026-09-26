/** Uniform JSON response helpers */
export const ok = (res, data = null, message = undefined, status = 200) =>
  res.status(status).json({ success: true, message, data });
export const created = (res, data = null, message = "Created successfully") =>
  ok(res, data, message, 201);

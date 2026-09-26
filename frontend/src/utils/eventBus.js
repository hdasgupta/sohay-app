/** Minimal pub/sub so non-React code (axios interceptors) can drive the loader and message box. */
export function createBus() {
  const listeners = new Set();
  return {
    emit: (payload) => listeners.forEach((l) => l(payload)),
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export const loaderBus = createBus(); // { type: 'start'|'stop', id, message }
export const messageBus = createBus(); // { type: 'info'|'success'|'warning'|'error', text, duration }
export const authBus = createBus(); // { type: 'expired' }

let seq = 0;
export const nextId = () => {
  seq += 1;
  return seq;
};

/** Imperative helpers */
export const notify = {
  info: (text, duration) => messageBus.emit({ type: "info", text, duration }),
  success: (text, duration) =>
    messageBus.emit({ type: "success", text, duration }),
  warning: (text, duration) =>
    messageBus.emit({ type: "warning", text, duration }),
  error: (text, duration) => messageBus.emit({ type: "error", text, duration }),
};

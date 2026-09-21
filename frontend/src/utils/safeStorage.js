/**
 * Small wrapper around window.localStorage.
 *
 * Browsers throw a SecurityError when storage is blocked (private mode,
 * sandboxed iframes, disabled cookies). Every read/write goes through here so a
 * blocked storage never breaks the application render.
 */
const memoryStore = new Map();

const nativeStorage = () => {
  try {
    const store = window.localStorage;
    const probe = '__wbffmh_probe__';
    store.setItem(probe, '1');
    store.removeItem(probe);
    return store;
  } catch (error) {
    console.warn('[storage] local storage is not available, falling back to memory', error);
    return null;
  }
};

let cached;
const store = () => {
  if (cached === undefined) cached = nativeStorage();
  return cached;
};

export const readItem = (key) => {
  const target = store();
  try {
    if (target) return target.getItem(key);
    return memoryStore.has(key) ? memoryStore.get(key) : null;
  } catch (error) {
    console.error('[storage] could not read key', key, error);
    return null;
  }
};

export const writeItem = (key, value) => {
  const target = store();
  try {
    if (target) target.setItem(key, value);
    else memoryStore.set(key, value);
  } catch (error) {
    console.error('[storage] could not write key', key, error);
  }
};

export const removeItem = (key) => {
  const target = store();
  try {
    if (target) target.removeItem(key);
    else memoryStore.delete(key);
  } catch (error) {
    console.error('[storage] could not remove key', key, error);
  }
};

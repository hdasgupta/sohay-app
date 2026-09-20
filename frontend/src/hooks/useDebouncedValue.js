import { useEffect, useState } from 'react';

/** Small helper used by the medicine and patient search boxes. */
export const useDebouncedValue = (value, delay = 400) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};

export default useDebouncedValue;

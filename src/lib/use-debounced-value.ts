/**
 * Returns `value` once it has been stable for `delayMs`. Derivations too
 * heavy to run per keystroke (include graph, whole-work word count) key on
 * the debounced copy; anything user-facing per keystroke stays on the live
 * value.
 */
import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

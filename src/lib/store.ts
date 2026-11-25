// Per-browser preferences. Every access is guarded: storage can be blocked or unavailable.
export const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(`fs:${key}`);
      return v == null ? fallback : (JSON.parse(v) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(`fs:${key}`, JSON.stringify(value));
    } catch {
      /* private mode or quota */
    }
  },
};

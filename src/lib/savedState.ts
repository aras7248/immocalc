/** Schema 3 adds vacancyPercent; older calculations inherit the UI default. */
export const SAVED_OBJECT_SCHEMA_VERSION = 3;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Keep explicitly saved values, including zero, and fill only missing fields. */
export function mergeState<T extends object>(defaults: T, value: unknown): T {
  if (!isRecord(value)) return { ...defaults };
  return Object.fromEntries(
    Object.entries(defaults as Record<string, unknown>).map(([key, fallback]) => {
      const candidate = value[key];
      return [key, typeof candidate === typeof fallback ? candidate : fallback];
    }),
  ) as T;
}

/** Missing or invalid scenario values in older objects retain the base case. */
export function readSavedScenarioCostIncrease(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value)) : 0;
}

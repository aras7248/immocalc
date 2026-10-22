/** Shared bounds for calculation inputs, saved objects and the UI. */
export const SCENARIO_PERCENT_MIN = -50;
export const SCENARIO_PERCENT_MAX = 100;

export function normalizeScenarioPercent(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(SCENARIO_PERCENT_MAX, Math.max(SCENARIO_PERCENT_MIN, value));
}

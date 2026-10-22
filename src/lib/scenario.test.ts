import assert from "node:assert/strict";
import test from "node:test";
import { normalizeScenarioPercent, SCENARIO_PERCENT_MIN, SCENARIO_PERCENT_MAX } from "./scenario.ts";

test("A4: scenario changes retain signed decimals and clamp to the supported range", () => {
  assert.equal(SCENARIO_PERCENT_MIN, -50);
  assert.equal(SCENARIO_PERCENT_MAX, 100);
  for (const [value, expected] of [[-100, -50], [-50, -50], [-12.5, -12.5], [0, 0], [75, 75], [100, 100], [150, 100]]) {
    assert.equal(normalizeScenarioPercent(value), expected);
  }
});

test("A4: invalid or missing saved scenario changes use zero", () => {
  for (const value of [undefined, null, "-10", NaN, Infinity, -Infinity, {}, []]) {
    assert.equal(normalizeScenarioPercent(value), 0);
  }
});

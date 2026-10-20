import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_VACANCY_PERCENT } from "./calculations.ts";
import { mergeState, SAVED_OBJECT_SCHEMA_VERSION } from "./savedState.ts";

const defaults = { vacancyPercent: DEFAULT_VACANCY_PERCENT.toFixed(2).replace(".", ","), instandhaltungQm: "1,00" };

test("A2: legacy saved states gain vacancy default without changing saved costs", () => {
  assert.equal(SAVED_OBJECT_SCHEMA_VERSION, 3);
  assert.deepEqual(mergeState(defaults, { instandhaltungQm: "0,00" }), {
    vacancyPercent: "2,00", instandhaltungQm: "0,00",
  });
});

test("A2: explicit zero and full vacancy survive saved-state loading", () => {
  for (const vacancyPercent of ["0,00", "100,00"]) {
    assert.equal(mergeState(defaults, { vacancyPercent }).vacancyPercent, vacancyPercent);
  }
  assert.deepEqual(mergeState(defaults, null), defaults);
  assert.deepEqual(mergeState(defaults, { vacancyPercent: 0 }), defaults);
});

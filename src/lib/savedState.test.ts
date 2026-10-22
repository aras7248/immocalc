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

test("A3: legacy saved scenario costs default to zero and saved values survive loading", async () => {
  const { readSavedScenarioCostIncrease } = await import("./savedState.ts");
  for (const value of [undefined, null, "2", NaN, Infinity]) {
    assert.equal(readSavedScenarioCostIncrease(value), 0);
  }
  assert.equal(readSavedScenarioCostIncrease(2.5), 2.5);
  assert.equal(readSavedScenarioCostIncrease(0), 0);
  assert.equal(readSavedScenarioCostIncrease(150), 100);
});

test("A4: negative scenario changes survive JSON save and reload", async () => {
  const { normalizeScenarioPercent } = await import("./scenario.ts");
  const { readSavedScenarioCostIncrease } = await import("./savedState.ts");
  const payload = JSON.parse(JSON.stringify({ rentIncrease: -12.5, scenarioCostIncreasePercent: -2.5 }));
  assert.equal(normalizeScenarioPercent(payload.rentIncrease), -12.5);
  assert.equal(readSavedScenarioCostIncrease(payload.scenarioCostIncreasePercent), -2.5);
  assert.equal(readSavedScenarioCostIncrease(-75), -50);
});

test("A5: legacy objects default to zero equity and optional interest term", () => {
  const defaults = { equityPercentOfPrice: "0,00", fixedInterestYears: "", zins: "4,00" };
  assert.deepEqual(mergeState(defaults, { zins: "3,80" }), { ...defaults, zins: "3,80" });
  const saved = JSON.parse(JSON.stringify({ equityPercentOfPrice: "20,00", fixedInterestYears: "10" }));
  assert.deepEqual(mergeState(defaults, saved), { ...defaults, ...saved });
});

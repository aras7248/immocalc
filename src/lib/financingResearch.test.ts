import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFinancingResearch,
  defaultPublicRateBenchmark,
} from "./financingResearch.ts";

test("marks self-use funding as a potential fit without promising approval", () => {
  const research = buildFinancingResearch({
    federalState: "Baden-Württemberg",
    financingUse: "owner-occupied",
    energyPlan: "unknown",
    householdProfile: "family-with-children",
  }, defaultPublicRateBenchmark());

  assert.equal(research.programs[0]?.fit, "possible");
  assert.equal(research.programs[1]?.fit, "possible");
  assert.equal(research.programs[3]?.fit, "possible");
  assert.match(research.programs[0]?.summary ?? "", /selbstgenutzten/i);
});

test("does not present owner-occupation programs as suitable for a capital investment", () => {
  const research = buildFinancingResearch({
    federalState: "NRW",
    financingUse: "investment",
    energyPlan: "none",
    householdProfile: "not-applicable",
  }, defaultPublicRateBenchmark());

  assert.equal(research.programs[0]?.fit, "not-matching");
  assert.equal(research.programs[1]?.fit, "not-matching");
  assert.equal(research.programs[2]?.fit, "not-matching");
  assert.equal(research.programs[3]?.fit, "not-matching");
});

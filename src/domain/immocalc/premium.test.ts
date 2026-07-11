import assert from "node:assert/strict";
import test from "node:test";

import {
  canCreatePremiumProject,
  createPremiumAnalysisEnvelope,
  getPremiumProjectLimit,
  hasPremiumAccess,
} from "./premium.ts";

test("maps ImmoCalc access levels to the agreed project limits", () => {
  assert.equal(getPremiumProjectLimit("free"), 0);
  assert.equal(getPremiumProjectLimit("investor"), 3);
  assert.equal(getPremiumProjectLimit("professional"), null);
  assert.equal(getPremiumProjectLimit("admin"), null);
});

test("enforces the investor limit without restricting professional or admin access", () => {
  assert.equal(canCreatePremiumProject("investor", 2), true);
  assert.equal(canCreatePremiumProject("investor", 3), false);
  assert.equal(canCreatePremiumProject("professional", 500), true);
  assert.equal(canCreatePremiumProject("admin", 500), true);
  assert.equal(hasPremiumAccess("free"), false);
  assert.equal(hasPremiumAccess("investor"), true);
});

test("creates versioned premium analysis envelopes", () => {
  assert.deepEqual(createPremiumAnalysisEnvelope({ purchasePrice: 350_000 }), {
    schemaVersion: 1,
    calculationVersion: "2026.1",
    input: { purchasePrice: 350_000 },
    result: null,
  });
});

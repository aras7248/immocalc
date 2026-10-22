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
});

test("enforces the investor limit without restricting professional access", () => {
  assert.equal(canCreatePremiumProject("investor", 2), true);
  assert.equal(canCreatePremiumProject("investor", 3), false);
  assert.equal(canCreatePremiumProject("professional", 500), true);
  assert.equal(hasPremiumAccess("free"), false);
  assert.equal(hasPremiumAccess("investor"), true);
});

test("creates versioned premium analysis envelopes", () => {
  assert.deepEqual(createPremiumAnalysisEnvelope({ purchasePrice: 350_000 }), {
    schemaVersion: 1,
    calculationVersion: "2026.2",
    input: { purchasePrice: 350_000 },
    result: null,
  });
});


test('E1: access comes from an unexpired database entitlement, not metadata',async()=>{
 const {resolveAccessLevel}=await import('./premium.ts');
 assert.equal(resolveAccessLevel({level:'professional',valid_until:null}),'professional');
 assert.equal(resolveAccessLevel({level:'investor',valid_until:'2020-01-01'}),'free');
 assert.equal(resolveAccessLevel({level:'admin'}),'free');
 assert.equal(resolveAccessLevel({user_metadata:{level:'professional'}}),'free');
});

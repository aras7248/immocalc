import assert from "node:assert/strict";
import test from "node:test";

import {
  GRUNDERWERBSTEUER_SAETZE_2026,
  calculateOperatingCosts,
  calculateReverse,
  calculateStandard,
  getLandTransferTaxRate,
  normalizeFiniteNonNegative,
} from "./calculations.ts";

const EPSILON = 1e-8;

function closeTo(actual: number, expected: number, epsilon = EPSILON): void {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`,
  );
}

const commonInput = {
  federalState: "NRW",
  notaryPercent: 2,
  brokerPercent: 3.57,
  hasBroker: true,
  livingArea: 268,
  maintenancePerSqmMonthly: 1,
  managementMonthly: 30,
  reserveMonthly: 50,
  interestPercent: 4,
  repaymentPercent: 1.5,
};

test("uses all current 2026 land-transfer tax rates", () => {
  assert.equal(Object.keys(GRUNDERWERBSTEUER_SAETZE_2026).length, 16);
  assert.equal(getLandTransferTaxRate("BW"), 5);
  assert.equal(getLandTransferTaxRate("BY"), 3.5);
  assert.equal(getLandTransferTaxRate("HB"), 5.5);
  assert.equal(getLandTransferTaxRate("SN"), 5.5);
  assert.equal(getLandTransferTaxRate("TH"), 5);
  assert.equal(getLandTransferTaxRate(" nrw "), 6.5);
  assert.equal(getLandTransferTaxRate("unknown"), 0);
});

test("calculates non-recoverable operating costs from all three components", () => {
  const costs = calculateOperatingCosts(commonInput);

  assert.equal(costs.maintenanceAnnual, 3_216);
  assert.equal(costs.managementAnnual, 360);
  assert.equal(costs.reserveAnnual, 600);
  assert.equal(costs.totalAnnual, 4_176);
  assert.equal(costs.totalMonthly, 348);
});

test("standard calculation finances only the purchase price and uses acquisition costs as equity", () => {
  const result = calculateStandard({
    ...commonInput,
    purchasePrice: 350_000,
    annualRent: 21_900,
  });

  assert.equal(result.acquisitionCosts.totalPercent, 12.07);
  assert.equal(result.acquisitionCosts.landTransferTaxAmount, 22_750);
  assert.equal(result.acquisitionCosts.notaryAmount, 7_000);
  closeTo(result.acquisitionCosts.brokerAmount, 12_495);
  closeTo(result.acquisitionCosts.totalAmount, 42_245);
  closeTo(result.acquisitionCosts.equityRequired, 42_245);
  closeTo(result.totalInvestment, 392_245);

  assert.equal(result.financing.principal, 350_000);
  assert.equal(result.financing.interestAnnual, 14_000);
  assert.equal(result.financing.repaymentAnnual, 5_250);
  assert.equal(result.financing.annuityAnnual, 19_250);

  assert.equal(result.base.noiAnnual, 17_724);
  assert.equal(result.base.cashFlowAnnual, -1_526);
  closeTo(result.base.grossRentalYieldPercent, 21_900 / 350_000 * 100);
  closeTo(result.base.netRentalYieldPercent, 17_724 / 392_245 * 100);
  closeTo(result.base.purchasePriceFactor, 350_000 / 21_900);
  closeTo(result.base.returnOnEquityPercent, -1_526 / 42_245 * 100);
  closeTo(result.squareMeterValues.purchasePricePerSqm, 350_000 / 268);
  closeTo(result.base.monthlyRentPerSqm, 21_900 / 12 / 268);

  assert.equal(result.base.chart.operatingCosts.annualAmount, 4_176);
  assert.equal(result.base.chart.interest.annualAmount, 14_000);
  assert.equal(result.base.chart.repayment.annualAmount, 3_724);
  assert.equal(result.base.chart.positiveCashFlow.annualAmount, 0);
  assert.equal(result.base.chart.coverageGapAnnual, 1_526);
  closeTo(
    result.base.chart.operatingCosts.percentOfRent +
      result.base.chart.interest.percentOfRent +
      result.base.chart.repayment.percentOfRent +
      result.base.chart.positiveCashFlow.percentOfRent,
    100,
  );
});

test("broker costs are ignored when no broker is selected", () => {
  const result = calculateStandard({
    ...commonInput,
    hasBroker: false,
    purchasePrice: 100_000,
    annualRent: 10_000,
  });

  assert.equal(result.acquisitionCosts.brokerPercent, 0);
  assert.equal(result.acquisitionCosts.brokerAmount, 0);
  assert.equal(result.acquisitionCosts.totalPercent, 8.5);
});

test("a zero-percent annuity remains finite and leaves NOI as cash flow", () => {
  const result = calculateStandard({
    federalState: "BY",
    notaryPercent: 0,
    brokerPercent: 0,
    purchasePrice: 100_000,
    annualRent: 12_000,
    livingArea: 100,
    maintenancePerSqmMonthly: 1,
    managementMonthly: 0,
    reserveMonthly: 0,
    interestPercent: 0,
    repaymentPercent: 0,
  });

  assert.equal(result.financing.annuityAnnual, 0);
  assert.equal(result.base.noiAnnual, 10_800);
  assert.equal(result.base.cashFlowAnnual, 10_800);
  assert.equal(result.base.chart.coverageGapAnnual, 0);
  assert.equal(result.base.chart.positiveCashFlow.annualAmount, 10_800);
});

test("reverse calculation subtracts operating costs before deriving the maximum purchase price", () => {
  const result = calculateReverse({
    ...commonInput,
    targetAnnualRent: 21_900,
    scenarioRentIncreasePercent: 10,
  });

  assert.equal(result.operatingCosts.totalAnnual, 4_176);
  assert.equal(result.base.availableAnnuityAnnual, 17_724);
  closeTo(result.base.maxPurchasePrice, 17_724 / 0.055);
  closeTo(
    result.base.acquisitionCosts.totalAmount,
    result.base.maxPurchasePrice * 0.1207,
  );
  closeTo(
    result.base.totalInvestment,
    result.base.maxPurchasePrice * 1.1207,
  );

  closeTo(result.scenario.annualRent, 24_090);
  closeTo(result.scenario.availableAnnuityAnnual, 19_914);
  closeTo(result.scenario.maxPurchasePrice, 19_914 / 0.055);
  assert.ok(result.scenario.maxPurchasePrice > result.base.maxPurchasePrice);
});

test("operating costs reduce reverse affordability by costs divided by the annuity rate", () => {
  const withoutCosts = calculateReverse({
    ...commonInput,
    targetAnnualRent: 21_900,
    maintenancePerSqmMonthly: 0,
    managementMonthly: 0,
    reserveMonthly: 0,
  });
  const withCosts = calculateReverse({
    ...commonInput,
    targetAnnualRent: 21_900,
  });

  closeTo(
    withoutCosts.base.maxPurchasePrice - withCosts.base.maxPurchasePrice,
    4_176 / 0.055,
  );
});

test("reverse calculation returns zero affordability for a zero annuity rate", () => {
  const result = calculateReverse({
    ...commonInput,
    targetAnnualRent: 21_900,
    interestPercent: 0,
    repaymentPercent: 0,
  });

  assert.equal(result.annuityPercent, 0);
  assert.equal(result.base.maxPurchasePrice, 0);
  assert.equal(result.base.acquisitionCosts.totalAmount, 0);
  assert.equal(result.base.totalInvestment, 0);
  assert.ok(Number.isFinite(result.base.maxPurchasePrice));
});

test("reverse offer analysis derives the required rent per square meter", () => {
  const result = calculateReverse({
    federalState: "NRW",
    notaryPercent: 2,
    brokerPercent: 3.57,
    hasBroker: true,
    livingArea: 100,
    maintenancePerSqmMonthly: 0,
    managementMonthly: 0,
    reserveMonthly: 0,
    targetAnnualRent: 100 * 25 * 12,
    offeredPurchasePrice: 500_000,
    interestPercent: 4,
    repaymentPercent: 1.5,
  });

  closeTo(result.base.maxPurchasePrice, 30_000 / 0.055);
  closeTo(result.offerAnalysis.requiredAnnualRent, 27_500);
  closeTo(result.offerAnalysis.requiredMonthlyRent, 27_500 / 12);
  closeTo(result.offerAnalysis.requiredMonthlyRentPerSqm, 27_500 / 12 / 100);
  assert.equal(result.offerAnalysis.isAffordableAtTargetRent, true);
  closeTo(result.offerAnalysis.annualRentGap, -2_500);
});

test("invalid and negative numeric inputs are normalized defensively", () => {
  assert.equal(normalizeFiniteNonNegative(Number.NaN), 0);
  assert.equal(normalizeFiniteNonNegative(Number.POSITIVE_INFINITY), 0);
  assert.equal(normalizeFiniteNonNegative(-1), 0);

  const result = calculateStandard({
    federalState: "invalid",
    notaryPercent: Number.NaN,
    brokerPercent: Number.POSITIVE_INFINITY,
    purchasePrice: -100_000,
    annualRent: Number.NEGATIVE_INFINITY,
    livingArea: -50,
    maintenancePerSqmMonthly: -1,
    managementMonthly: Number.NaN,
    reserveMonthly: -10,
    interestPercent: -4,
    repaymentPercent: Number.NaN,
    scenarioRentIncreasePercent: -10,
  });

  assert.equal(result.input.purchasePrice, 0);
  assert.equal(result.input.annualRent, 0);
  assert.equal(result.input.livingArea, 0);
  assert.equal(result.acquisitionCosts.totalAmount, 0);
  assert.equal(result.financing.annuityAnnual, 0);
  assert.equal(result.base.cashFlowAnnual, 0);
  assert.equal(result.base.chart.coveragePercent, 100);
  assert.ok(Number.isFinite(result.base.netRentalYieldPercent));
});

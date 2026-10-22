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


// A1: Protect the actual UI example as well as the calculation fixture.
test("A1: standard UI starts with realistic costs and labels pre-tax results", async () => {
  const { readFile } = await import("node:fs/promises");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const defaults = page.split("const initialCalcState: CalcState = {")[1].split("};")[0];
  for (const [field, expected] of Object.entries({
    instandhaltungQm: "1,00", verwaltungPm: "30,00", ruecklagePm: "50,00",
  })) {
    assert.ok(defaults.includes(`${field}: "${expected}"`));
  }
  assert.ok(page.includes("CF / Monat (vor Steuern)"));
  assert.ok(page.includes("CF / Jahr (vor Steuern)"));
  assert.ok(page.includes("Netto-Rendite (vor Steuern)"));
  assert.equal(calculateStandard({ ...commonInput, purchasePrice: 350_000, annualRent: 21_900 }).base.cashFlowAnnual, -1_526);
});

for (const vacancyPercent of [0, 2, 100]) {
  test(`A2: ${vacancyPercent}% vacancy affects NOI, cashflow and rent coverage only`, () => {
    const result = calculateStandard({ ...commonInput, purchasePrice: 350_000, annualRent: 21_900, vacancyPercent });
    const effective = 21_900 * (1 - vacancyPercent / 100);
    closeTo(result.base.effectiveAnnualRent, effective);
    closeTo(result.base.vacancyAnnual, 21_900 - effective);
    closeTo(result.base.cashFlowAnnual, effective - 4_176 - 19_250);
    closeTo(result.base.grossRentalYieldPercent, 21_900 / 350_000 * 100);
    closeTo(result.base.purchasePriceFactor, 350_000 / 21_900);
    closeTo(result.base.chart.coveredOutflowAnnual, Math.min(effective, 23_426));
    const reverse = calculateReverse({ ...commonInput, targetAnnualRent: 21_900, vacancyPercent });
    if (vacancyPercent < 100) {
      const roundTrip = calculateStandard({ ...commonInput, purchasePrice: reverse.base.maxPurchasePrice, annualRent: 21_900, vacancyPercent });
      closeTo(roundTrip.base.cashFlowAnnual, 0);
    } else {
      assert.equal(reverse.base.maxPurchasePrice, 0);
      assert.equal(result.base.chart.coveragePercent, 0);
    }
  });
}

test("A2: offer analysis requires contractual rent sufficient after vacancy", () => {
  const reverse = calculateReverse({ ...commonInput, targetAnnualRent: 21_900, offeredPurchasePrice: 350_000, vacancyPercent: 2 });
  const standard = calculateStandard({ ...commonInput, purchasePrice: 350_000, annualRent: reverse.offerAnalysis.requiredAnnualRent, vacancyPercent: 2 });
  closeTo(standard.base.cashFlowAnnual, 0);
  assert.equal(calculateStandard({ ...commonInput, purchasePrice: 350_000, annualRent: 21_900, vacancyPercent: 2 }).base.cashFlowAnnual, -1_964);
  assert.equal(calculateReverse({ ...commonInput, targetAnnualRent: 21_900, offeredPurchasePrice: 350_000, vacancyPercent: 100 }).offerAnalysis.isAffordableAtTargetRent, false);
});

test("A2: vacancy applies to scenarios and is bounded defensively", () => {
  const result = calculateStandard({ ...commonInput, purchasePrice: 350_000, annualRent: 21_900, scenarioRentIncreasePercent: 10, vacancyPercent: 2 });
  closeTo(result.scenario.effectiveAnnualRent, 24_090 * 0.98);
  for (const [input, expected] of [[-3, 0], [150, 100], [NaN, 0], [Infinity, 0]]) {
    assert.equal(calculateStandard({ ...commonInput, purchasePrice: 350_000, annualRent: 21_900, vacancyPercent: input }).input.vacancyPercent, expected);
  }
});

test("A3: cost increase affects each scenario cost and leaves the base case unchanged", () => {
  const input = { ...commonInput, purchasePrice: 350_000, annualRent: 21_900, vacancyPercent: 2 };
  const baseline = calculateStandard(input);
  const result = calculateStandard({ ...input, scenarioCostIncreasePercent: 10 });
  assert.deepEqual(result.base, baseline.base);
  assert.deepEqual(result.operatingCosts, baseline.operatingCosts);
  closeTo(result.scenarioOperatingCosts.maintenanceAnnual, 3_216 * 1.1);
  closeTo(result.scenarioOperatingCosts.managementAnnual, 360 * 1.1);
  closeTo(result.scenarioOperatingCosts.reserveAnnual, 600 * 1.1);
  closeTo(result.scenarioOperatingCosts.totalAnnual, 4_176 * 1.1);
  closeTo(result.scenarioOperatingCosts.totalMonthly, 348 * 1.1);
  closeTo(result.scenario.cashFlowAnnual, -1_964 - 417.6);
  closeTo(result.scenario.chart.requiredOutflowAnnual, 19_250 + 4_176 * 1.1);
});

test("A3: omitted and zero scenario cost increases preserve previous results", () => {
  const standard = { ...commonInput, purchasePrice: 350_000, annualRent: 21_900, scenarioRentIncreasePercent: 10 };
  const reverse = { ...commonInput, targetAnnualRent: 21_900, offeredPurchasePrice: 350_000, scenarioRentIncreasePercent: 10 };
  assert.deepEqual(calculateStandard(standard), calculateStandard({ ...standard, scenarioCostIncreasePercent: 0 }));
  assert.deepEqual(calculateReverse(reverse), calculateReverse({ ...reverse, scenarioCostIncreasePercent: 0 }));
});

test("A3: reverse scenario includes increased costs and round-trips to break-even", () => {
  const input = { ...commonInput, targetAnnualRent: 21_900, offeredPurchasePrice: 350_000, vacancyPercent: 2, scenarioRentIncreasePercent: 10 };
  const baseline = calculateReverse(input);
  const reverse = calculateReverse({ ...input, scenarioCostIncreasePercent: 2 });
  assert.deepEqual(reverse.base, baseline.base);
  assert.deepEqual(reverse.offerAnalysis, baseline.offerAnalysis);
  closeTo(reverse.scenario.noiAnnual, 24_090 * 0.98 - 4_176 * 1.02);
  closeTo(baseline.scenario.maxPurchasePrice - reverse.scenario.maxPurchasePrice, 4_176 * 0.02 / 0.055);
  const standard = calculateStandard({ ...input, purchasePrice: reverse.scenario.maxPurchasePrice, annualRent: 21_900, scenarioCostIncreasePercent: 2 });
  closeTo(standard.scenario.cashFlowAnnual, 0);
});

// A4: Negative values are valid scenarios; only non-finite values default to zero.
test("A3: invalid scenario cost input defaults to zero", () => {
  for (const scenarioCostIncreasePercent of [NaN, Infinity]) {
    const result = calculateStandard({ ...commonInput, purchasePrice: 350_000, annualRent: 21_900, scenarioCostIncreasePercent });
    assert.equal(result.input.scenarioCostIncreasePercent, 0);
    assert.deepEqual(result.scenarioOperatingCosts, result.operatingCosts);
  }
});

test("A4: falling rents and costs affect only the scenario", () => {
  const input = { ...commonInput, purchasePrice: 350_000, annualRent: 21_900, vacancyPercent: 2 };
  const baseline = calculateStandard(input);
  const result = calculateStandard({ ...input, scenarioRentIncreasePercent: -10, scenarioCostIncreasePercent: -20 });
  assert.deepEqual(result.base, baseline.base);
  closeTo(result.scenario.annualRent, 21_900 * 0.9);
  closeTo(result.scenario.effectiveAnnualRent, 21_900 * 0.9 * 0.98);
  closeTo(result.scenarioOperatingCosts.totalAnnual, 4_176 * 0.8);
  closeTo(result.scenario.cashFlowAnnual, 21_900 * 0.9 * 0.98 - 4_176 * 0.8 - 19_250);
  closeTo(result.scenario.chart.requiredOutflowAnnual, 4_176 * 0.8 + 19_250);
});

test("A4: signed reverse scenarios round-trip to zero cashflow", () => {
  for (const scenarioRentIncreasePercent of [-50, -12.5, 0, 100]) {
    for (const scenarioCostIncreasePercent of [-50, -2.5, 0, 100]) {
      const input = { ...commonInput, vacancyPercent: 2, scenarioRentIncreasePercent, scenarioCostIncreasePercent };
      const reverse = calculateReverse({ ...input, targetAnnualRent: 21_900 });
      const standard = calculateStandard({ ...input, purchasePrice: reverse.scenario.maxPurchasePrice, annualRent: 21_900 });
      closeTo(standard.scenario.cashFlowAnnual, 0);
    }
  }
});

test("A4: both calculators bound rent and cost changes consistently", () => {
  for (const [raw, expected] of [[-75, -50], [-50, -50], [75, 75], [125, 100]]) {
    const standard = calculateStandard({ ...commonInput, purchasePrice: 350_000, annualRent: 21_900, scenarioRentIncreasePercent: raw, scenarioCostIncreasePercent: raw });
    const reverse = calculateReverse({ ...commonInput, targetAnnualRent: 21_900, scenarioRentIncreasePercent: raw, scenarioCostIncreasePercent: raw });
    for (const input of [standard.input, reverse.input]) {
      assert.equal(input.scenarioRentIncreasePercent, expected);
      assert.equal(input.scenarioCostIncreasePercent, expected);
    }
    closeTo(standard.scenarioOperatingCosts.totalAnnual, 4_176 * (1 + expected / 100));
    assert.deepEqual(reverse.scenarioOperatingCosts, standard.scenarioOperatingCosts);
  }
});

for (const equityPercentOfPrice of [0, 20, 100]) {
  test(`A5: ${equityPercentOfPrice}% equity reduces principal and uses total equity for returns`, () => {
    const result = calculateStandard({ ...commonInput, purchasePrice: 350_000, annualRent: 21_900, equityPercentOfPrice });
    const equityInPrice = 350_000 * equityPercentOfPrice / 100;
    const principal = 350_000 - equityInPrice;
    closeTo(result.financing.equityInPrice, equityInPrice);
    closeTo(result.financing.principal, principal);
    closeTo(result.financing.interestAnnual, principal * 0.04);
    closeTo(result.financing.repaymentAnnual, principal * 0.015);
    closeTo(result.financing.annuityAnnual, principal * 0.055);
    closeTo(result.totalEquityRequired, 42_245 + equityInPrice);
    closeTo(result.totalInvestment, principal + result.totalEquityRequired);
    closeTo(result.base.cashFlowAnnual, 17_724 - principal * 0.055);
    closeTo(result.base.returnOnEquityPercent, result.base.cashFlowAnnual / result.totalEquityRequired * 100);
    closeTo(result.acquisitionCosts.totalAmount, 42_245);
    closeTo(result.base.netRentalYieldPercent, 17_724 / 392_245 * 100);
  });
}

test("A5: zero equity preserves the previous standard and reverse model", () => {
  const input = { ...commonInput, purchasePrice: 350_000, annualRent: 21_900 };
  assert.deepEqual(calculateStandard(input), calculateStandard({ ...input, equityPercentOfPrice: 0 }));
  const reverse = { ...commonInput, targetAnnualRent: 21_900, offeredPurchasePrice: 350_000 };
  assert.deepEqual(calculateReverse(reverse), calculateReverse({ ...reverse, equityPercentOfPrice: 0 }));
});

test("A5: reverse price and offer analysis match financing with equity", () => {
  const input = { ...commonInput, equityPercentOfPrice: 20, vacancyPercent: 2, scenarioRentIncreasePercent: -10, scenarioCostIncreasePercent: 2 };
  const reverse = calculateReverse({ ...input, targetAnnualRent: 21_900, offeredPurchasePrice: 350_000 });
  closeTo(reverse.base.maxPurchasePrice, (21_900 * 0.98 - 4_176) / (0.055 * 0.8));
  for (const which of ["base", "scenario"] as const) {
    const result = calculateStandard({ ...input, purchasePrice: reverse[which].maxPurchasePrice, annualRent: 21_900 });
    closeTo(result[which].cashFlowAnnual, 0);
    closeTo(reverse[which].totalEquityRequired, result.totalEquityRequired);
    closeTo(reverse[which].financing.principal, result.financing.principal);
  }
  const offer = calculateStandard({ ...input, purchasePrice: 350_000, annualRent: reverse.offerAnalysis.requiredAnnualRent });
  closeTo(offer.base.cashFlowAnnual, 0);
  closeTo(reverse.offerAnalysis.financing.principal, 280_000);
  closeTo(reverse.offerAnalysis.totalEquityRequired, 112_245);
});

test("A5: full equity reports an unbounded cashflow price rather than a finite ceiling", () => {
  const input = { ...commonInput, equityPercentOfPrice: 100, targetAnnualRent: 21_900, offeredPurchasePrice: 350_000 };
  const result = calculateReverse(input);
  assert.equal(result.base.priceLimitStatus, "unbounded");
  assert.equal(result.scenario.priceLimitStatus, "unbounded");
  assert.equal(result.offerAnalysis.financing.principal, 0);
  closeTo(result.offerAnalysis.totalEquityRequired, 392_245);
  closeTo(result.offerAnalysis.requiredAnnualRent, 4_176);
  assert.equal(result.offerAnalysis.isAffordableAtTargetRent, true);
  assert.equal(calculateReverse({ ...input, targetAnnualRent: 1_000 }).base.priceLimitStatus, "unaffordable");
});

test("A5: fixed interest years are optional metadata and do not change first-year results", () => {
  const input = { ...commonInput, purchasePrice: 350_000, annualRent: 21_900, equityPercentOfPrice: 20 };
  const baseline = calculateStandard(input);
  const result = calculateStandard({ ...input, fixedInterestYears: 10 });
  assert.equal(baseline.financing.fixedInterestYears, null);
  assert.equal(result.financing.fixedInterestYears, 10);
  assert.deepEqual(result.base, baseline.base);
  assert.deepEqual(result.scenario, baseline.scenario);
  const reverse = calculateReverse({ ...commonInput, targetAnnualRent: 21_900, offeredPurchasePrice: 350_000, fixedInterestYears: 15 });
  assert.equal(reverse.base.financing.fixedInterestYears, 15);
  assert.equal(reverse.offerAnalysis.financing.fixedInterestYears, 15);
});

test("A5: financing parameters are normalized defensively", () => {
  for (const [raw, expected] of [[-1, 0], [150, 100], [NaN, 0], [Infinity, 0]]) {
    const result = calculateStandard({ ...commonInput, purchasePrice: 350_000, annualRent: 21_900, equityPercentOfPrice: raw });
    assert.equal(result.input.equityPercentOfPrice, expected);
  }
  for (const [raw, expected] of [[0, null], [NaN, null], [Infinity, null], [10.8, 10], [50, 30]]) {
    const result = calculateStandard({ ...commonInput, purchasePrice: 350_000, annualRent: 21_900, fixedInterestYears: raw ?? undefined });
    assert.equal(result.input.fixedInterestYears, expected);
  }
});

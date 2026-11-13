import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePremiumInvestment,
  canCreatePremiumProject,
  createPremiumAnalysisEnvelope,
  getPremiumProjectLimit,
  hasPremiumAccess,
} from "./premium.ts";

function closeTo(actual: number, expected: number, epsilon = 1e-8): void {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`,
  );
}

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

const paderbornInput = {
  purchasePrice: 969_000,
  livingArea: 638,
  monthlyRent: 6_380,
  federalState: "NRW",
  notaryPercent: 2,
  brokerPercent: 3.57,
  hasBroker: false,
  maintenancePerSqmMonthly: 1,
  managementMonthly: 300,
  reserveMonthly: 0,
  vacancyPercent: 0,
  renovationCosts: 0,
  otherInitialCosts: 0,
  costBufferPercent: 10,
  equityAmount: 82_365,
  interestPercent: 4,
  repaymentPercent: 1.5,
  fixedInterestYears: 10,
  followUpInterestPercent: 5.5,
  specialRepaymentAnnual: 0,
  rentGrowthPercent: 1.5,
  costGrowthPercent: 2,
  valueGrowthPercent: 1.5,
  exitCostPercent: 3,
  forecastYears: 10,
};

test("calculates the Paderborn premium investment without relabeling total investment as purchase price", () => {
  const result = calculatePremiumInvestment(paderbornInput);

  assert.equal(result.acquisitionCostAmount, 82_365);
  assert.equal(result.totalInvestment, 1_051_365);
  assert.equal(result.loanAmount, 969_000);
  closeTo(result.purchasePricePerSqm, 969_000 / 638);
  closeTo(result.totalInvestmentPerSqm, 1_051_365 / 638);
  assert.equal(result.scheduledAnnualRent, 76_560);
  assert.equal(result.operatingCostsAnnual, 11_256);
  assert.equal(result.noiAnnual, 65_304);
  assert.equal(result.annualDebtService, 53_295);
  assert.equal(result.annualCashFlow, 12_009);
  closeTo(result.monthlyCashFlow, 1_000.75);
  closeTo(result.breakEvenRentPerSqm, 5_379.25 / 638);
  closeTo(result.dscr, 65_304 / 53_295);
});

test("builds a real amortization schedule and four comparable scenarios", () => {
  const result = calculatePremiumInvestment(paderbornInput);

  assert.equal(result.projection.length, 10);
  assert.equal(result.projection[0].interest, 38_760);
  assert.equal(result.projection[0].repayment, 14_535);
  assert.equal(result.projection[0].remainingDebt, 954_465);
  assert.ok(result.projection[9].remainingDebt < result.projection[0].remainingDebt);
  assert.deepEqual(
    result.scenarios.map((scenario) => scenario.id),
    ["conservative", "realistic", "optimistic", "stress"],
  );
  assert.ok(result.scenarios.every((scenario) => Number.isFinite(scenario.totalProfit)));
  assert.ok(Number.isFinite(result.irrPercent));
});

test("keeps empty premium inputs finite", () => {
  const result = calculatePremiumInvestment({
    ...paderbornInput,
    purchasePrice: 0,
    livingArea: 0,
    monthlyRent: 0,
    equityAmount: 0,
  });

  assert.equal(result.purchasePricePerSqm, 0);
  assert.equal(result.monthlyCashFlow, -300);
  assert.equal(result.dscr, 0);
  assert.equal(result.irrPercent, 0);
  assert.ok(result.projection.every((year) => Number.isFinite(year.cashFlow)));
});

test("premium cash flow includes the two additional monthly owner costs once", () => {
  const result = calculatePremiumInvestment({
    ...paderbornInput,
    nonRecoverableHoaMonthly: 70,
    otherOwnerCostsMonthly: 20,
  });

  assert.equal(result.operatingCostsAnnual, 11_256 + 90 * 12);
  closeTo(result.monthlyCashFlow, 1_000.75 - 90);
});

test("payment defaults only reduce rent remaining after vacancy", () => {
  const input = { ...paderbornInput, vacancyPercent: 10 };
  const vacancyOnly = calculatePremiumInvestment(input);
  const withDefault = calculatePremiumInvestment({ ...input, rentDefaultPercent: 5 });
  closeTo(withDefault.effectiveAnnualRent, input.monthlyRent * 12 * 0.9 * 0.95);
  closeTo(withDefault.monthlyCashFlow, vacancyOnly.monthlyCashFlow - input.monthlyRent * 0.9 * 0.05);
  closeTo(withDefault.projection[0].cashFlow, withDefault.annualCashFlow);
  closeTo(withDefault.breakEvenRentPerSqm, vacancyOnly.breakEvenRentPerSqm / 0.95);

  const vacant = calculatePremiumInvestment({ ...input, vacancyPercent: 100, rentDefaultPercent: 5 });
  assert.equal(vacant.effectiveAnnualRent, 0);
});

test("a funding tranche replaces part of bank financing and contributes its own rate", () => {
  const funding = {
    name: "Förderdarlehen",
    amount: 100_000,
    interestPercent: 1,
    repaymentPercent: 2,
    fixedInterestYears: 1,
    followUpInterestPercent: 3,
  };
  const result = calculatePremiumInvestment({ ...paderbornInput, additionalLoans: [funding] });

  assert.equal(result.loanAmount, 969_000);
  assert.deepEqual(result.loans.map(loan => loan.amount), [869_000, 100_000]);
  closeTo(result.annualDebtService, 869_000 * 0.055 + 100_000 * 0.03);
  closeTo(result.monthlyCashFlow, (result.noiAnnual - result.annualDebtService) / 12);
  closeTo(result.projection[0].remainingDebt, 869_000 * 0.985 + 98_000);
  closeTo(result.projection[1].interest, 869_000 * 0.985 * 0.04 + 98_000 * 0.03);
  closeTo(result.projection[1].debtService, 869_000 * 0.055 + 98_000 * 0.05);

  const withExtraPayment = calculatePremiumInvestment({
    ...paderbornInput,
    specialRepaymentAnnual: 1_200,
    additionalLoans: [funding],
  });
  closeTo(withExtraPayment.loans[0].monthlyDebtServiceYearOne, 869_000 * 0.055 / 12 + 100);
  closeTo(withExtraPayment.loans[1].monthlyDebtServiceYearOne, 250);
  closeTo(withExtraPayment.loans.reduce((sum, loan) => sum + loan.monthlyDebtServiceYearOne, 0),
    withExtraPayment.annualDebtService / 12);
  closeTo(withExtraPayment.loans.reduce((sum, loan) => sum + loan.remainingDebtAtExit, 0),
    withExtraPayment.remainingDebtAtExit);

  const capped = calculatePremiumInvestment({
    ...paderbornInput,
    additionalLoans: [{ ...funding, amount: 1_000_000 }, funding],
  });
  assert.deepEqual(capped.loans.map(loan => loan.amount), [0, 969_000, 0]);
});

test("each loan pays interest only for its own grace period", () => {
  const result = calculatePremiumInvestment({
    ...paderbornInput,
    interestOnlyYears: 1,
    specialRepaymentAnnual: 1_200,
    additionalLoans: [{
      name: "Förderdarlehen",
      amount: 100_000,
      interestPercent: 1,
      repaymentPercent: 2,
      fixedInterestYears: 1,
      followUpInterestPercent: 3,
      interestOnlyYears: 2,
    }],
  });

  closeTo(result.loans[0].monthlyDebtServiceYearOne, 869_000 * 0.04 / 12);
  closeTo(result.loans[1].monthlyDebtServiceYearOne, 100_000 * 0.01 / 12);
  assert.equal(result.projection[0].repayment, 0);
  assert.equal(result.projection[0].remainingDebt, 969_000);
  closeTo(result.monthlyCashFlow, (result.noiAnnual - 869_000 * 0.04 - 1_000) / 12);
  closeTo(result.projection[1].repayment, 869_000 * 0.015 + 1_200);
  closeTo(result.projection[1].interest, 869_000 * 0.04 + 3_000);
  closeTo(result.projection[2].repayment,
    (869_000 * 0.055 - (869_000 * 0.985 - 1_200) * 0.04) + 1_200 + 2_000);
});

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import test from "node:test";

import {
  createInvestmentReportPdf,
  type InvestmentReportData,
} from "./investmentReport.ts";

const sampleReport: InvestmentReportData = {
  generatedAt: new Date("2026-07-25T10:00:00.000Z"),
  object: {
    name: "Dahler Weg - Objekt 6250",
    livingArea: 638,
    unitCount: 8,
    yearBuilt: 1968,
    federalState: "NRW",
  },
  status: {
    tone: "negative",
    label: "Negatives Szenario",
    summary: "Der aktuelle Cashflow ist negativ und erfordert eine Anpassung.",
  },
  acquisition: {
    purchasePrice: 969_000,
    totalInvestment: 1_051_365,
    acquisitionCostPercent: 8.5,
    landTransferTaxPercent: 6.5,
    landTransferTaxAmount: 62_985,
    notaryPercent: 2,
    notaryAmount: 19_380,
    brokerPercent: 0,
    brokerAmount: 0,
    equityAmount: 0,
    loanAmount: 1_051_365,
    financingRatioPercent: 108.5,
  },
  rent: {
    monthly: 3_540.3,
    annual: 42_483.6,
    perSqm: 5.55,
    operatingCostsMonthly: 938,
    operatingCostsAnnual: 11_256,
    noiMonthly: 2_602.3,
    noiAnnual: 31_227.6,
  },
  financing: {
    interestPercent: 4,
    repaymentPercent: 1.5,
    annuityPercent: 5.5,
    interestMonthly: 3_504.55,
    repaymentMonthly: 1_314.21,
    debtServiceMonthly: 4_818.76,
  },
  performance: {
    cashFlowMonthly: -2_216.46,
    cashFlowAnnual: -26_597.52,
    grossYieldPercent: 4.38,
    netYieldPercent: 2.97,
    purchasePriceFactor: 22.81,
    returnOnEquityPercent: null,
  },
  potential: {
    rentIncreasePercent: 15,
    baseRentAfterIncreaseMonthly: 4_071.345,
    vacancyReactivationMonthly: 300,
    parkingMonthly: 250,
    solarMonthly: 120,
    otherMonthly: 0,
    monthly: 4_741.345,
    annual: 56_896.14,
    perSqm: 7.43,
    cashFlowMonthly: -1_015.42,
    totalInvestmentPerSqm: 1_647.91,
  },
  targetRent: {
    rentPerSqm: 10,
    monthly: 6_380,
    annual: 76_560,
    maxPurchasePrice: 966_032.68,
    totalInvestment: 1_048_145.45,
    purchasePricePerSqm: 1_514.16,
    totalInvestmentPerSqm: 1_643.22,
    acquisitionCosts: 82_112.78,
    loanAmount: 1_048_145.45,
    cashFlowAtOfferMonthly: 623.24,
    offerGap: 2_967.32,
  },
  reverse: {
    valueAtCurrentRent: 506_000,
    totalInvestmentAtCurrentRent: 549_010,
    offerValueGap: 463_000,
    offerValueGapPercent: 91.5,
    breakEvenBuffer: {
      bufferPercent: 10,
      requiredMonthlyRent: 6_332.436,
      requiredAnnualRent: 75_989.232,
      requiredRentPerSqm: 9.925448,
      monthlyRentGapToCurrent: 2_792.136,
      rentChangePercentToCurrent: 78.866,
      cashFlowMonthly: 575.676,
    },
    breakEven: {
      requiredMonthlyRent: 5_756.76,
      requiredAnnualRent: 69_081.12,
      requiredRentPerSqm: 9.02,
      monthlyRentGap: 2_216.46,
      rentChangePercent: 62.61,
    },
    comfort: {
      targetCashFlowPercent: 10,
      targetCashFlowMonthlyAtOffer: 639.64,
      targetCashFlowMonthlyAtCurrentRent: 354.03,
      requiredMonthlyRent: 6_396.4,
      requiredAnnualRent: 76_756.8,
      requiredRentPerSqm: 10.03,
      monthlyRentGap: 2_856.1,
      rentChangePercent: 80.67,
      maxPurchasePriceAtCurrentRent: 452_000,
      totalInvestmentAtCurrentRent: 490_420,
    },
  },
  plausibility: {
    tone: "negative",
    label: "anspruchsvoll",
    explanation: "Die notwendige Mietsteigerung muss am lokalen Markt geprüft werden.",
  },
};

test("creates a compact two-page investment report PDF", () => {
  const document = createInvestmentReportPdf(sampleReport);
  const bytes = document.output("arraybuffer");

  assert.equal(document.getNumberOfPages(), 2);
  assert.ok(bytes.byteLength > 10_000);

  if (process.env.WRITE_REPORT_PREVIEW === "1") {
    mkdirSync("output/pdf", { recursive: true });
    writeFileSync(
      "output/pdf/immocalc-investitionsanalyse-vorschau.pdf",
      Buffer.from(bytes),
    );
  }
});

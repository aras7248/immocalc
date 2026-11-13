import test from "node:test";
import assert from "node:assert/strict";
import { PREMIUM_ANALYSIS_STEPS } from "./premiumAnalysisPrompts.ts";
import {
  createAnalysisStep,
  createAnalysisReport,
  analysisFingerprint,
  renderAnalysisReportHtml,
} from "./premiumAnalysis.ts";
import {
  createPremiumChatSystemPrompt,
  type PremiumChatContext,
} from "./premiumChat.ts";
const c: PremiumChatContext = {
  object: {
    name: "Test",
    federalState: "NRW",
    livingArea: 100,
    purchasePrice: 300000,
    yearBuilt: 1995,
  },
  calculation: {
    monthlyRent: 0,
    annualRent: 0,
    totalInvestment: 330000,
    acquisitionCosts: 30000,
    loanAmount: 330000,
    interestPercent: 4,
    repaymentPercent: 2,
    annualDebtService: 19800,
    operatingCostsAnnual: 2400,
    monthlyCashFlow: -1850,
    dscr: 0,
    breakEvenRentPerSqm: 18.5,
    vacancyPercent: 0,
  },
};
test("All six original prompts are ordered and available to the model", () => {
  assert.deepEqual(
    PREMIUM_ANALYSIS_STEPS.map((s) => s.id),
    [1, 2, 3, 4, 5, 6],
  );
  const system = createPremiumChatSystemPrompt({
    ...c,
    analysisStep: 3,
    analysisEvidence: "Mietspiegel: Quelle noch offen",
  });
  for (const s of PREMIUM_ANALYSIS_STEPS) assert.ok(system.includes(s.prompt));
  assert.match(system, /AKTUELLER SCHRITT: 3/);
  assert.match(system, /Mietspiegel: Quelle noch offen/);
});
test("Missing rents do not become cashflow or yield verdicts", () => {
  const r = createAnalysisStep(3, c, "");
  assert.ok(r.missing.length);
  assert.match(r.text, /nicht bewertbar/);
  assert.doesNotMatch(r.text, /-1.850/);
});
test("Market and risk steps do not invent scores, price ranges or discounts", () => {
  assert.match(
    createAnalysisStep(2, c, "Vergleichsangebot https://example.org").text,
    /ungeprüft/,
  );
  const r = createAnalysisStep(4, c, "");
  assert.match(r.text, /nicht beziffert/);
  assert.match(r.text, /noch nicht belastbar ableitbar/);
});
test("Report retains every reviewed step and consolidates open issues", () => {
  const results = PREMIUM_ANALYSIS_STEPS.slice(0, 5).map(
    (s) => createAnalysisStep(s.id, c, "").text,
  );
  const report = createAnalysisReport(c, results);
  assert.match(report, /Management-Summary/);
  for (let i = 1; i <= 5; i++) assert.ok(report.includes(`## ${i}.`));
  assert.match(report, /Annahmen & offene Punkte – Gesamtübersicht/);
  assert.match(report, /Vergleichsangebote/);
});
test("Changing assumptions invalidates an earlier analysis fingerprint", () => {
  assert.notEqual(
    analysisFingerprint(c),
    analysisFingerprint({
      ...c,
      calculation: { ...c.calculation, interestPercent: 5 },
    }),
  );
});

test("Printable report renders tables and escapes source text", () => {
  const html = renderAnalysisReportHtml(
    "# Bericht\n\n| Kennzahl | Wert |\n| --- | --- |\n| Miete | 1.200 € |\n\n<script>alert(1)</script>",
  );
  assert.match(html, /<table>/);
  assert.match(html, /1.200 €/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('Economic step includes all requested debt horizons and individual stress tests', () => {
 const investmentInput={purchasePrice:300000,livingArea:100,monthlyRent:1500,federalState:'NRW',notaryPercent:2,brokerPercent:0,hasBroker:false,maintenancePerSqmMonthly:1,managementMonthly:50,reserveMonthly:50,vacancyPercent:3,renovationCosts:20000,otherInitialCosts:0,costBufferPercent:10,equityAmount:50000,interestPercent:4,repaymentPercent:2,fixedInterestYears:10,followUpInterestPercent:5.5,specialRepaymentAnnual:0,rentGrowthPercent:1,costGrowthPercent:2,valueGrowthPercent:1,exitCostPercent:3,forecastYears:10};
 const result=createAnalysisStep(3,{...c,investmentInput,calculation:{...c.calculation,monthlyRent:1500,annualRent:18000}},'');
 for(const phrase of ['10 Jahre','15 Jahre','20 Jahre','+0,5','+1,0','−10 %','+5 %','10.000','Cash-on-Cash','vor Steuern'])assert.ok(result.text.includes(phrase),phrase);
 assert.doesNotMatch(result.text,/NaN|Infinity|undefined/);
});

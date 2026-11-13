import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFParse } from 'pdf-parse';
import { calculatePremiumInvestment } from '../domain/immocalc/premium.ts';
import { createPremiumAssessmentPdf, type PremiumAssessmentReportData } from './premiumAssessmentReport.ts';
import { extractExposeFacts } from './exposeImport.ts';

const result = calculatePremiumInvestment({
  purchasePrice: 1295000, livingArea: 863, monthlyRent: 55000 / 12,
  federalState: 'NRW', notaryPercent: 2, brokerPercent: 3.57, hasBroker: true,
  maintenancePerSqmMonthly: 0, managementMonthly: 0, reserveMonthly: 0,
  vacancyPercent: 0, renovationCosts: 0, otherInitialCosts: 0, costBufferPercent: 10,
  equityAmount: 0, interestPercent: 4, repaymentPercent: 1.5, fixedInterestYears: 10,
  followUpInterestPercent: 5.5, specialRepaymentAnnual: 0,
  rentGrowthPercent: 1.5, costGrowthPercent: 2, valueGrowthPercent: 1.5,
  exitCostPercent: 3, forecastYears: 10,
});
const base: PremiumAssessmentReportData = {
  generatedAt: new Date('2026-11-13T10:00:00Z'),
  object: { name: 'Musterweg 12+14, 33100 Beispielstadt', federalState: 'NRW', livingArea: 863, yearBuilt: 1996 },
  result, scenarios: [],
};
async function readReport(data: PremiumAssessmentReportData) {
  const doc = createPremiumAssessmentPdf(data);
  const parser = new PDFParse({ data: new Uint8Array(doc.output('arraybuffer')) });
  try { return await parser.getText(); }
  finally { await parser.destroy(); }
}
const compact = (text: string) => text.replace(/\s+/g, '');

test('premium PDF includes every imported fact, including units beyond the seventh fact', async () => {
  const exposeFacts = extractExposeFacts(`Objektart Haus
Objektadresse: Musterweg 12+14, 33100 Beispielstadt
Kaufpreis 1.295.000 EUR
Jahresnettokaltmiete 55.000 EUR
Provision 3,57 % inkl. 19 % MwSt.
Wohnfläche 863 m²
Grundstück 1.738 m²
Anzahl Wohneinheiten 12
Zimmer gesamt 32
Baujahr 1996
Heizungsart Zentralheizung
Befeuerung Gas`);
  assert.equal(exposeFacts.facts.length, 12);
  const report = await readReport({ ...base, exposeFacts });
  assert.equal(report.pages.length, 8);
  const text = compact(report.text);
  for (const fact of exposeFacts.facts) assert.ok(text.includes(compact(fact.label + fact.value)), fact.key);
});

test('many facts and multi-page values remain complete, with sequential PDF page numbers', async () => {
  const facts = Array.from({ length: 90 }, (_, index) => ({
    key: `test${index}`, label: `Fakt ${index + 1}`, value: `Vollstaendiger Wert ${index + 1}`,
  }));
  const details = Array.from({ length: 1800 }, (_, index) => `Detail${String(index).padStart(4, '0')}`);
  facts.splice(45, 0, { key: 'long', label: 'Langer Sachverhalt', value: `${details.join(' ')} ENDMARKE` });
  const report = await readReport({ ...base, exposeFacts: { facts, warnings: [] } });
  assert.ok(report.pages.length > 9);
  const text = compact(report.text);
  for (const fact of facts.filter(fact => fact.key !== 'long')) assert.ok(text.includes(compact(fact.value)), fact.key);
  // Page footers can interrupt a multi-page value in extracted PDF text.
  for (const detail of [...details, 'ENDMARKE']) assert.ok(text.includes(detail), detail);
  report.pages.forEach((page, index) => assert.ok(
    page.text.includes(`Seite ${index + 1} von ${report.pages.length}`), `footer on page ${index + 1}`,
  ));
  assert.ok(text.includes('Lage-undMarktanalyse'));
  assert.ok(text.includes('Darlehensübersicht'));
});

test('premium PDF still works without imported facts', async () => {
  const report = await readReport(base);
  assert.ok(report.text.includes('Noch keine strukturierten Exposé-Fakten hinterlegt.'));
  assert.equal(report.pages.length, 8);
});

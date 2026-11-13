import assert from "node:assert/strict";
import test from "node:test";

import {
  createCalculationAssistantAnswer,
  type PremiumChatContext,
} from "./premiumChat.ts";

const baseContext: PremiumChatContext = {
  object: {
    name: "Testobjekt",
    federalState: "NRW",
    livingArea: 100,
    purchasePrice: 300_000,
    yearBuilt: 0,
  },
  calculation: {
    monthlyRent: 0,
    annualRent: 0,
    totalInvestment: 330_000,
    acquisitionCosts: 30_000,
    loanAmount: 330_000,
    interestPercent: 4,
    repaymentPercent: 1.5,
    annualDebtService: 18_150,
    operatingCostsAnnual: 2_400,
    monthlyCashFlow: -1_712.5,
    dscr: 0,
    breakEvenRentPerSqm: 17.13,
    vacancyPercent: 3,
  },
  exposeFacts: { facts: [], warnings: [] },
};

test("asks for only the critical missing inputs before a full premium analysis", () => {
  const reply = createCalculationAssistantAnswer(
    baseContext,
    "Erstelle eine strukturierte Vollanalyse.",
  );

  assert.equal(reply.needsInput, true);
  assert.match(reply.answer, /vollständige Objektadresse/i);
  assert.match(reply.answer, /Ist-Kaltmiete/i);
  assert.match(reply.answer, /Mit vorhandenen Daten fortfahren/i);
});

test("skips unverifiable phases when the user continues with available data", () => {
  const reply = createCalculationAssistantAnswer(
    baseContext,
    "Bitte mit den vorhandenen Daten fortfahren und nicht belegbare Phasen überspringen.",
  );

  assert.equal(reply.needsInput, false);
  assert.match(reply.answer, /1\. Rolle, Objektdaten/);
  assert.doesNotMatch(reply.answer, /Phase 2: Lage- und Marktanalyse/);
  assert.doesNotMatch(reply.answer, /Phase 4: Wirtschaftlichkeitsberechnung/);
  assert.doesNotMatch(reply.answer, /Phase 9/);
});

test("keeps a user-provided heating fact for the following answer", () => {
  const history = [{ role: "user" as const, text: "Es ist eine Gasheizung verbaut." }];
  const acknowledgement = createCalculationAssistantAnswer(baseContext, history[0].text, history);
  const followUp = createCalculationAssistantAnswer(
    baseContext,
    "Welche Unterlagen fehlen noch?",
    history,
  );

  assert.match(acknowledgement.answer, /Gasheizung/);
  assert.match(acknowledgement.answer, /berücksichtige ab jetzt/i);
  assert.match(followUp.answer, /genannten Heizung/i);
  assert.doesNotMatch(followUp.answer, /Angaben zu Heizung und Modernisierungen/);
});

test("uses a rent supplied in the conversation for the next cashflow answer", () => {
  const history = [{ role: "user" as const, text: "Die Kaltmiete beträgt 2.000 Euro pro Monat." }];
  const reply = createCalculationAssistantAnswer(baseContext, "Wie hoch ist der Cashflow?", history);

  assert.match(reply.answer, /2\.000,00\s?€/);
  assert.match(reply.answer, /Gespräch ergänzten Angaben/i);
});

import assert from "node:assert/strict";
import test from "node:test";
import { parseNumber } from "./numbers.ts";
import { extractOcrTextData } from "./exposeOcr.ts";
import { extractExposeTextData } from "./exposeImport.ts";

test("German thousands survive import and annual rent calculation", () => {
  for (const [input, expected] of [["1.200", 1200], ["9.999", 9999], ["300.000", 300000], ["1.200,50", 1200.5], ["1200.50", 1200.5], ["4.5", 4.5], ["1.200.000", 1200000]] as const) {
    assert.equal(parseNumber(input), expected, input);
  }
  const imported = extractExposeTextData("Kaufpreis: 300.000 EUR\nWohnfläche: 100 m²\nKaltmiete: 1.200 EUR\nBaujahr: 1995");
  assert.equal(parseNumber(imported.mietePM!), 1200);
  assert.equal(parseNumber(imported.mietePM!) * 12, 14400);
  assert.equal(imported.baujahr, "1995");
});

test("OCR text supports EUR and euro sign for monthly rent", () => {
  for (const unit of ["EUR", "€"]) {
    const result = extractExposeTextData(`Kaufpreis: 300.000 ${unit}\nWohnfläche: 100 m²\nKaltmiete: 1.200 ${unit}\nBaujahr: 1995`);
    assert.equal(result.kaufpreis, "300.000");
    assert.equal(result.wohnflaeche, "100");
    assert.equal(result.mietePM, "1.200");
  }
});

test("OCR tolerates missing area units and umlauts", () => {
  const result = extractOcrTextData("Festpreis: 300.000 EUR\nWohnflache: 100 m?\nEinnahmen: 1.200 EUR");
  assert.equal(result.wohnflaeche, "100");
  assert.equal(parseNumber(result.kaufpreis!), 300000);
  assert.equal(parseNumber(result.mietePM!), 1200);
});

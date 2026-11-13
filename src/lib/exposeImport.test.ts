import test from 'node:test';
import assert from 'node:assert/strict';
import { extractExposeData, extractExposeTextData, extractExposeFacts } from './exposeImport.ts';
import { extractOcrTextData } from './exposeOcr.ts';

test('document address replaces file title and keeps numbers', () => {
  const text = 'Objektadresse:\nHauptstraße 12a\n70173 Stuttgart\nKaufpreis: 350.000 €\nWohnfläche: 120 m²';
  const data = extractExposeTextData(text, 'expose-4711.pdf');
  assert.equal(data.address, 'Hauptstraße 12a, 70173 Stuttgart');
  assert.equal(data.objektname, data.address);
  assert.equal(data.kaufpreis, '350.000');
  assert.equal(extractExposeFacts(text).facts.find(f => f.key === 'address')?.value, data.address);
});
test('OCR retains recognized address for confirmation', () => {
  assert.equal(extractOcrTextData('Adresse: Am Stadtpark 7\nKaufpreis: 280.000 EUR').address, 'Am Stadtpark 7');
});
test('property JSON-LD address takes precedence over listing title', () => {
  const html = '<title>Schöne Wohnung</title><script type="application/ld+json">{"@type":"Apartment","address":{"streetAddress":"Gartenweg 5","postalCode":"10115","addressLocality":"Berlin"}}</script>';
  assert.equal(extractExposeData(html).objektname, 'Gartenweg 5, 10115 Berlin');
});
test('broker address and ambiguous property addresses do not overwrite the object', () => {
  assert.equal(extractExposeTextData('Makler\nKontakt: Gartenweg 5\n10115 Berlin', 'Exposé.pdf').address, undefined);
  assert.equal(extractExposeTextData('Objektadresse: Gartenweg 5\nObjektadresse: Hauptstraße 2').address, undefined);
  assert.equal(extractExposeData('<script type="application/ld+json">{"@type":"RealEstateAgent","address":{"streetAddress":"Gartenweg 5"}}</script>').address, undefined);
});

// Synthetic regression fixture matching PDF text-layer quirks; no original document is stored.
const pdfText = `Wohnfläche ca. 863 m²
Zimmer gesamt 32
Kaufpreis 1.295.000,00 e
Provision 3,57 % inkl. 19 % MwSt.
Baujahr 1996
Anzahl Schlafzimmer 20
Das Wohnhaus wurde im Jahre 1991 errichtet.
Die aktuelle Jahresnettokaltmiete inkl. der Carport- und
Pkw-Außenstellplätze beträgt ca. e 55.000,–.
Baujahr Heizung 2019
a) Bauträger – Innencourtage: bis zu 5,95% der Kaufsumme inkl. MwSt.`;

test('PDF font artifacts and annual rent yield the correct calculation inputs', () => {
  const data = extractExposeTextData(pdfText);
  assert.equal(data.kaufpreis, '1.295.000');
  assert.equal(data.wohnflaeche, '863');
  assert.equal(data.mietePM, '4.583,33');
  assert.equal(data.maklerProzent, '3,57');
  assert.equal(data.commissionWarning, undefined);
  const facts = extractExposeFacts(pdfText);
  assert.equal(facts.facts.find(f => f.key === 'rooms')?.value, '32');
  assert.equal(facts.facts.find(f => f.key === 'annualRent')?.value, '55.000 €');
  assert.ok(facts.warnings.some(w => w.includes('1996 / 1991') && !w.includes('2019')));
  assert.ok(facts.warnings.some(w => w.includes('durch 12')));
});

test('explicit monthly rent takes precedence and bedrooms are not total rooms', () => {
  assert.equal(extractExposeTextData('Jahreskaltmiete 24.000 EUR\nKaltmiete 1.900 EUR').mietePM, '1.900');
  assert.equal(extractExposeFacts('Anzahl Schlafzimmer 20').facts.find(f => f.key === 'rooms'), undefined);
  assert.equal(extractExposeTextData('Kaufpreis 350.000 energieeffizient').kaufpreis, undefined);
});

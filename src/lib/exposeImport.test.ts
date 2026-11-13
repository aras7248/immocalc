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

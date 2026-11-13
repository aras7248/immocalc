import { extractExposeTextData, type ExposeImportResult } from "./exposeImport.ts";

export function extractOcrTextData(text: string): ExposeImportResult {
  const { objektname: _sourceName, ...results } = extractExposeTextData(text);
  void _sourceName;
  // OCR often loses the superscript or umlaut. Keep explicit labels useful
  // even when the area unit cannot be recognized.
  results.wohnflaeche ??= text.match(/Wohnfl(?:ä|ae|a)che[:\s]*([\d.,]+)/i)?.[1]
    ?? text.match(/([\d.,]+)\s*(?:m[²2]|qm)/i)?.[1];
  results.kaufpreis ??= text.match(/\b(?:Kaufpreis|Festpreis|Preis)[:\s]*([\d.,]+)\s*(?:€|EUR)/i)?.[1];
  results.mietePM ??= text.match(/\bEinnahmen[:\s]*([\d.,]+)\s*(?:€|EUR)/i)?.[1];
  return Object.fromEntries(Object.entries(results).filter(([, value]) => value !== undefined && value !== ""));
}

import { MAX_EXPOSE_FILE_BYTES, EXPOSE_FILE_SIZE_ERROR } from './exposeFileLimits.ts';
import { extractExposeData, extractExposeFacts, extractExposeTextData } from './exposeImport.ts';

/** Documents stay on the user's device and avoid the hosting upload limit. */
export async function importBrowserExposeFile(file: File) {
  if (!file.size || file.size > MAX_EXPOSE_FILE_BYTES) throw new Error(EXPOSE_FILE_SIZE_ERROR);
  let text: string;
  if (/\.docx$/i.test(file.name)) {
    const { extractRawText } = await import('mammoth/mammoth.browser.js');
    text = (await extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
  } else if (/\.pdf$/i.test(file.name)) {
    const { PDFParse } = await import('pdf-parse');
    PDFParse.setWorker('/workers/pdf.worker.min.mjs');
    const parser = new PDFParse({ data: new Uint8Array(await file.arrayBuffer()) });
    try { text = (await parser.getText()).text; }
    finally { await parser.destroy(); }
  } else text = await file.text();
  text = text.slice(0, 1_000_000);
  const data = /\.html?$/i.test(file.name) ? extractExposeData(text) : extractExposeTextData(text, file.name);
  if (!data.kaufpreis && !data.wohnflaeche && !data.mietePM) throw new Error('Keine eindeutigen Rechendaten erkannt. Bei gescannten PDFs bitte die Seiten über „Exposé hochladen“ als Bild auswählen.');
  return { data, facts: extractExposeFacts(text, file.name) };
}

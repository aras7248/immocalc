import { extractExposeData, extractExposeFacts, extractExposeTextData } from './exposeImport';

/** PDFs stay on the user's device and avoid the hosting upload limit. */
export async function importBrowserExposeFile(file: File) {
  if (!file.size || file.size > 12 * 1024 * 1024) throw new Error('Die Datei muss zwischen 1 Byte und 12 MB groß sein.');
  if (/\.docx$/i.test(file.name)) {
    if (file.size > 4 * 1024 * 1024) throw new Error('DOCX-Dateien über 4 MB bitte als PDF speichern und erneut ablegen.');
    const body = new FormData();
    body.append('file', file);
    const response = await fetch('/api/expose-file-import', { method: 'POST', body });
    if (!response.ok) throw new Error('Die DOCX-Datei konnte nicht gelesen werden. Bitte als PDF speichern und erneut versuchen.');
    return await response.json();
  }
  let text: string;
  if (/\.pdf$/i.test(file.name)) {
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

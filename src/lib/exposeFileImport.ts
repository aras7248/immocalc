import { extractRawText } from "mammoth";
import {
  extractExposeData,
  extractExposeFacts,
  extractExposeTextData,
  type ExposeFacts,
  type ExposeImportResult,
} from "@/lib/exposeImport";

export const MAX_EXPOSE_FILE_BYTES = 12 * 1024 * 1024;
const MAX_EXTRACTED_TEXT_LENGTH = 1_000_000;

const getExtension = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

export const supportedExposeFileExtensions = ["pdf", "docx", "txt", "html", "htm"] as const;

export function isSupportedExposeFile(name: string, mimeType = "") {
  const extension = getExtension(name);
  return supportedExposeFileExtensions.includes(extension as (typeof supportedExposeFileExtensions)[number])
    || [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/html",
    ].includes(mimeType);
}

const hasNumericExposeData = (data: Record<string, unknown>) => ["kaufpreis", "wohnflaeche", "mietePM"].some((key) => Boolean(data[key]));

const extractPdfText = async (data: Uint8Array) => {
  // PDF.js needs canvas geometry even for text extraction in Node. Initialize
  // explicitly so serverless tracing includes the native Linux dependency.
  const canvas = await import("@napi-rs/canvas");
  Object.assign(globalThis, {
    DOMMatrix: globalThis.DOMMatrix ?? canvas.DOMMatrix,
    ImageData: globalThis.ImageData ?? canvas.ImageData,
    Path2D: globalThis.Path2D ?? canvas.Path2D,
  });
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
};

export type ImportedExposeFile = {
  data: ExposeImportResult;
  facts: ExposeFacts;
};

/**
 * Parses a user-provided local file. The caller is responsible for choosing
 * the file source; this function never reads from the filesystem itself.
 */
export async function importExposeFile({
  name,
  mimeType = "",
  binary,
}: {
  name: string;
  mimeType?: string;
  binary: Uint8Array;
}): Promise<ImportedExposeFile> {
  if (!isSupportedExposeFile(name, mimeType)) {
    throw new Error("Unterstützt werden PDF, DOCX, TXT und HTML. Bilder kannst du direkt über den Scan-Button hochladen.");
  }
  if (binary.length === 0 || binary.length > MAX_EXPOSE_FILE_BYTES) {
    throw new Error("Die Datei muss zwischen 1 Byte und 12 MB groß sein.");
  }

  const extension = getExtension(name);
  let text = "";
  let data: ExposeImportResult;

  if (extension === "pdf" || mimeType === "application/pdf") {
    if (String.fromCharCode(...binary.slice(0, 5)) !== "%PDF-") {
      throw new Error("Die Datei ist keine gültige PDF-Datei.");
    }
    text = await extractPdfText(binary);
    data = extractExposeTextData(text.slice(0, MAX_EXTRACTED_TEXT_LENGTH), name);
  } else if (extension === "docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    if (String.fromCharCode(...binary.slice(0, 2)) !== "PK") {
      throw new Error("Die Datei ist keine gültige DOCX-Datei.");
    }
    const result = await extractRawText({ buffer: Buffer.from(binary) });
    text = result.value;
    data = extractExposeTextData(text.slice(0, MAX_EXTRACTED_TEXT_LENGTH), name);
  } else {
    text = new TextDecoder("utf-8").decode(binary);
    data = extension === "html" || extension === "htm" || mimeType === "text/html"
      ? extractExposeData(text.slice(0, MAX_EXTRACTED_TEXT_LENGTH))
      : extractExposeTextData(text.slice(0, MAX_EXTRACTED_TEXT_LENGTH), name);
  }

  if (!hasNumericExposeData(data)) {
    throw new Error("Im Dokument wurden keine eindeutigen Rechendaten gefunden. Bei gescannten PDFs lade bitte die relevanten Seiten als Bild hoch.");
  }

  return {
    data,
    facts: extractExposeFacts(text.slice(0, MAX_EXTRACTED_TEXT_LENGTH), name),
  };
}

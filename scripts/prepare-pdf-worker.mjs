import { createRequire } from 'node:module';
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const pdfRequire = createRequire(require.resolve('pdf-parse'));
const pdfjsDirectory = dirname(pdfRequire.resolve('pdfjs-dist/package.json'));
await mkdir('public/workers', { recursive: true });
await copyFile(join(pdfjsDirectory, 'legacy/build/pdf.worker.min.mjs'), 'public/workers/pdf.worker.min.mjs');

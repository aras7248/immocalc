import test from 'node:test';
import assert from 'node:assert/strict';
import { importBrowserExposeFile } from './browserExposeFileImport.ts';
import { MAX_EXPOSE_FILE_BYTES } from './exposeFileLimits.ts';

test('imports an expose larger than 12 MB locally without a server upload', async () => {
  const file = new File(['Kaufpreis: 350.000 EUR\nWohnfläche: 100 m²\n', ' '.repeat(13 * 1024 * 1024)], 'expose.txt');
  const result = await importBrowserExposeFile(file);
  assert.ok(result.data.kaufpreis);
  assert.ok(result.data.wohnflaeche);
});

test('accepts the 50 MB boundary and rejects empty or oversized files before reading', async () => {
  const atLimit = { name: 'expose.txt', size: MAX_EXPOSE_FILE_BYTES, text: async () => 'Kaufpreis: 350.000 EUR' } as File;
  assert.ok((await importBrowserExposeFile(atLimit)).data.kaufpreis);
  for (const size of [0, MAX_EXPOSE_FILE_BYTES + 1]) {
    await assert.rejects(importBrowserExposeFile({ ...atLimit, size } as File), /50 MB/);
  }
});

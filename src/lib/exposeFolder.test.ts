import test from 'node:test';
import assert from 'node:assert/strict';
import { unseenFolderFiles, folderFileKey } from './exposeFolder.ts';
const file = (name: string, lastModified = 100, size = 200) => ({ name, lastModified, size });
test('folder scan ignores unsupported and hidden files and keeps equal timestamps', () => {
  assert.deepEqual(unseenFolderFiles([file('b.pdf'), file('a.DOCX'), file('note.exe'), file('.hidden.pdf')], new Set()).map(f => f.name), ['a.DOCX', 'b.pdf']);
});
test('unchanged files are skipped but revised and newly added files are imported', () => {
  const old = file('a.pdf');
  const seen = new Set([folderFileKey(old)]);
  assert.deepEqual(unseenFolderFiles([old, file('a.pdf', 101), file('b.pdf')], seen).map(f => f.name), ['b.pdf', 'a.pdf']);
});
test('same named files from different subfolders remain distinct', () => {
  const first = { ...file('a.pdf'), webkitRelativePath: 'folder/one/a.pdf' };
  const second = { ...file('a.pdf'), webkitRelativePath: 'folder/two/a.pdf' };
  assert.deepEqual(unseenFolderFiles([first, second], new Set([folderFileKey(first)])), [second]);
});

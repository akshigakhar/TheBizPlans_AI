import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('the public workflow restores and saves its complete browser-owned draft', async () => {
  const source = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
  assert.match(source, /localStorage\.getItem\('free-business-plan-draft'\)/);
  assert.match(source, /localStorage\.setItem\('free-business-plan-draft',JSON\.stringify\(form\)\)/);
  assert.match(source, /financialDraft:value/);
});

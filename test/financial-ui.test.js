import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('financial editors import the icons used by their action controls', async () => {
  const source = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
  const lucideImport = source.match(/import \{([^}]+)\} from 'lucide-react';/)?.[1] ?? '';
  const importedIcons = new Set(lucideImport.split(',').map(name => name.trim()));

  for (const icon of ['Copy', 'PencilLine', 'X']) {
    assert.ok(importedIcons.has(icon), `${icon} must be imported before the financial editor renders it`);
  }
});

test('review renders a complete plan index and keeps generated statements in financial projections', async () => {
  const source = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');

  assert.match(source, /const sections=PLAN_SECTIONS/);
  assert.match(source, /<span>Business Plan<\/span>/);
  assert.match(source, /<h2>Financial Projections<\/h2>/);
  for (const page of ['Financial Overview', 'Income Statement', 'Cash Flow Statement', 'Balance Sheet']) {
    assert.match(source, new RegExp(page));
  }
  assert.match(source, /This section is ready for your content/);
});

test('financial projections are available before navigating directly to review', async () => {
  const source = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
  const effect = source.slice(source.indexOf("const review={assumptions:centralAssumptions"), source.indexOf('const years=annualize(months)'));

  assert.ok(effect.includes('onReviewChange(review)'), 'the calculated review must be published synchronously');
  assert.ok(
    effect.indexOf('onReviewChange(review)') < effect.indexOf('calculateFinancialAssumptionsHash(centralAssumptions)'),
    'review data must be published before waiting for the assumptions hash',
  );
});

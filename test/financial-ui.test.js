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

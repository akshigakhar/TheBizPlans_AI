import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const base = 'supabase/migrations/20260812185225_remote_schema.sql';
const migrations = readdirSync('migrations').filter(name => name.endsWith('.sql')).sort();
const sources = [base, ...migrations.map(name => `migrations/${name}`)];
const banner = `-- GENERATED FILE: run npm run database:sql to rebuild.\n-- Execute this entire file in the Supabase SQL Editor for a new project.\n-- The seed step requires akshi.gakhar@gmail.com to exist in Authentication first.\n\n`;
const sql = banner + sources.map(path => `-- ============================================================================\n-- SOURCE: ${path}\n-- ============================================================================\n${readFileSync(path, 'utf8').trim()}\n`).join('\n');
mkdirSync('docs', { recursive: true });
writeFileSync('docs/database-setup.sql', sql);
console.log(`Wrote docs/database-setup.sql from ${sources.length} ordered SQL files.`);

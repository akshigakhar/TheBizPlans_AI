import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const base = 'supabase/migrations/20260812185225_remote_schema.sql';
const migrations = readdirSync('migrations').filter(name => name.endsWith('.sql')).sort();
const sources = [base, ...migrations.map(name => `migrations/${name}`)];
const render = (banner, paths) => banner + paths.map(path => `-- ============================================================================\n-- SOURCE: ${path}\n-- ============================================================================\n${readFileSync(path, 'utf8').trim()}\n`).join('\n');
mkdirSync('docs', { recursive: true });
writeFileSync('docs/database-setup.sql', render(`-- GENERATED FILE: run npm run database:sql to rebuild.\n-- FRESH PROJECTS ONLY: execute in an empty Supabase project.\n-- Do not run this file over an existing business_plans table; use database-upgrade.sql.\n-- The seed requires akshi.gakhar@gmail.com to exist in Authentication first.\n\n`, sources));
writeFileSync('docs/database-upgrade.sql', render(`-- GENERATED FILE: run npm run database:sql to rebuild.\n-- EXISTING PROJECT: the base business_plans schema already exists.\n-- Apply once in the Supabase SQL Editor, then use normal migrations thereafter.\n-- The seed requires akshi.gakhar@gmail.com to exist in Authentication first.\n\n`, sources.slice(1)));
const seedSources = [
  'migrations/20260813000000_persist_business_plan_data.sql',
  'migrations/20260813010000_seed_akshi_business_plans.sql',
];
writeFileSync('docs/database-seed.sql', render(`-- GENERATED FILE: safe targeted fix for an already configured project.\n-- Adds plan_data if missing and upserts the four requested plans.\n-- The Auth user akshi.gakhar@gmail.com must already exist.\n\n`, seedSources));
const rebuildPrelude = `-- DESTRUCTIVE: removes and recreates every application object in public.\n-- Authentication users in auth are preserved. All existing public data is deleted.\n-- Confirm akshi.gakhar@gmail.com exists in Authentication before running.\n\ndrop schema if exists public cascade;\ncreate schema public authorization postgres;\ncomment on schema public is 'standard public schema';\ngrant usage on schema public to postgres, anon, authenticated, service_role;\ngrant all on schema public to postgres, service_role;\ngrant create on schema public to postgres, service_role;\n\n`;
writeFileSync('docs/database-rebuild.sql', rebuildPrelude + render('', sources));
console.log(`Wrote fresh, upgrade, seed, and destructive rebuild SQL bundles from ${sources.length} ordered SQL files.`);

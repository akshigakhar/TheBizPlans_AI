import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSupabaseConfig } from '../src/lib/supabase/config.ts';

test('keeps the bundled production URL and publishable key together', () => {
  const config = resolveSupabaseConfig({
    VITE_SUPABASE_URL: 'https://bfokmiteswljdgjjvxtt.supabase.co/',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'stale-key',
  });

  assert.equal(config.url, 'https://bfokmiteswljdgjjvxtt.supabase.co');
  assert.equal(config.publishableKey, 'sb_publishable_c5qHrVsPgUc9I3In4IwL2g_fvMrOJ28');
});

test('uses the configured key for a different Supabase project', () => {
  const config = resolveSupabaseConfig({
    VITE_SUPABASE_URL: 'https://preview-project.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'preview-publishable-key',
  });

  assert.deepEqual(config, {
    url: 'https://preview-project.supabase.co',
    publishableKey: 'preview-publishable-key',
  });
});

test('supports the legacy anon-key variable for a different project', () => {
  const config = resolveSupabaseConfig({
    VITE_SUPABASE_URL: 'https://local-project.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'legacy-anon-key',
  });

  assert.equal(config.publishableKey, 'legacy-anon-key');
});

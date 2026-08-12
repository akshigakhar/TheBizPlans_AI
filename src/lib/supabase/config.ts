// These browser-safe defaults keep authentication and data access working when
// a deployment has not explicitly copied the values from `.env.example`.
// Supabase publishable keys are intentionally public; database authorization is
// still enforced by Row Level Security.
const defaultSupabaseUrl = 'https://bfokmiteswljdgjjvxtt.supabase.co';
const defaultPublishableKey = 'sb_publishable_c5qHrVsPgUc9I3In4IwL2g_fvMrOJ28';
const env = (import.meta as any).env || {};

type SupabaseBrowserEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

export function resolveSupabaseConfig(values: SupabaseBrowserEnv = {}) {
  const url = (values.VITE_SUPABASE_URL?.trim() || defaultSupabaseUrl).replace(/\/$/, '');
  const configuredKey = (
    values.VITE_SUPABASE_PUBLISHABLE_KEY || values.VITE_SUPABASE_ANON_KEY || ''
  ).trim();

  // A stale Vercel variable previously overrode the current key bundled for the
  // production project. Keep that project URL and key together as one pair.
  // Preview/local deployments for another Supabase project must supply both.
  const publishableKey = url === defaultSupabaseUrl ? defaultPublishableKey : configuredKey;
  return { url, publishableKey };
}

const resolved = resolveSupabaseConfig(env);
export const supabaseUrl = resolved.url;
export const supabasePublishableKey = resolved.publishableKey;

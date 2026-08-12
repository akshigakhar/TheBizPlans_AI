// These browser-safe defaults keep authentication and data access working when
// a deployment has not explicitly copied the values from `.env.example`.
// Supabase publishable keys are intentionally public; database authorization is
// still enforced by Row Level Security.
const defaultSupabaseUrl = 'https://bfokmiteswljdgjjvxtt.supabase.co';
const defaultPublishableKey = 'sb_publishable_c5qHrVsPgUc9I3In4IwL2g_fvMrOJ28';
const env = (import.meta as any).env || {};

export const supabaseUrl = (
  env.VITE_SUPABASE_URL || defaultSupabaseUrl
).replace(/\/$/, '');

export const supabasePublishableKeys = [
  env.VITE_SUPABASE_PUBLISHABLE_KEY,
  env.VITE_SUPABASE_ANON_KEY,
  defaultPublishableKey,
].filter((key, index, keys): key is string => Boolean(key) && keys.indexOf(key) === index);

export const supabasePublishableKey = supabasePublishableKeys[0] || '';

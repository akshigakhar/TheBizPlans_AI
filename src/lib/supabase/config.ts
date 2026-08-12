// These browser-safe defaults keep authentication and data access working when
// a deployment has not explicitly copied the values from `.env.example`.
// Supabase publishable keys are intentionally public; database authorization is
// still enforced by Row Level Security.
const defaultSupabaseUrl = 'https://bfokmiteswljdgjjvxtt.supabase.co';
const defaultPublishableKey = 'sb_publishable_c5qHrVsPgUc9I3In4IwL2g_fvMrOJ28';

export const supabaseUrl = (
  (import.meta as any).env?.VITE_SUPABASE_URL || defaultSupabaseUrl
).replace(/\/$/, '');

export const supabasePublishableKey =
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || defaultPublishableKey;

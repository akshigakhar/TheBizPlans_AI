import { supabasePublishableKey as publishableKey, supabaseUrl } from './config.ts';

export type AuthUser = { id: string; email?: string; user_metadata?: Record<string, unknown> };
export type AuthSession = { access_token: string; refresh_token: string; expires_at: number; expires_in?: number; user: AuthUser };
export type RestoredAuth = { session: AuthSession | null; recovery: boolean };

const configuredRedirectUrl = (import.meta as any).env?.VITE_AUTH_REDIRECT_URL || '';
const storageKey = 'thebizplans-auth-session';
let refreshInFlight: Promise<AuthSession> | null = null;

function authRedirectUrl() {
  return configuredRedirectUrl || `${location.origin}${location.pathname}`;
}

function assertConfigured() {
  if (!supabaseUrl || !publishableKey) throw new Error('Supabase authentication is not configured.');
}

export function authErrorMessage(value: any) {
  const message = value?.msg || value?.message || value?.error_description || value?.error;
  if (typeof message === 'string' && /invalid api key/i.test(message)) {
    return 'Account service configuration is out of date. Please contact support.';
  }
  if (typeof message === 'string' && /(?:error|failed) sending confirmation email/i.test(message)) {
    return "We couldn't send your confirmation email. Please try again shortly or contact support.";
  }
  return message || 'Authentication request failed.';
}

export function isConfirmationEmailError(value: unknown) {
  const message = value instanceof Error ? value.message : authErrorMessage(value);
  return /(?:couldn't|error|failed) (?:send|sending) (?:your )?confirmation email/i.test(message);
}

async function request(path: string, init: RequestInit = {}) {
  assertConfigured();
  const response = await fetch(`${supabaseUrl}/auth/v1${path}`, {
    ...init,
    headers: { apikey: publishableKey, 'content-type': 'application/json', ...init.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(authErrorMessage(data));
  return data;
}

function persist(session: AuthSession | null) {
  if (session) localStorage.setItem(storageKey, JSON.stringify(session));
  else localStorage.removeItem(storageKey);
}

function normalize(data: any): AuthSession | null {
  if (!data?.access_token || !data?.user) return null;
  const session = {
    ...data,
    expires_at: Number(data.expires_at || Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600)),
  } as AuthSession;
  persist(session);
  return session;
}

async function refresh(session: AuthSession) {
  if (!session.refresh_token) throw new Error('Your session has expired. Please sign in again.');
  if (!refreshInFlight) {
    refreshInFlight = request('/token?grant_type=refresh_token', {
      method: 'POST', body: JSON.stringify({ refresh_token: session.refresh_token }),
    }).then(data => {
      const refreshed = normalize(data);
      if (!refreshed) throw new Error('The session refresh response was invalid. Please sign in again.');
      return refreshed;
    }).finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

function callbackValues() {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(location.search);
  const error = hash.get('error_description') || query.get('error_description');
  if (error) {
    history.replaceState({}, '', location.pathname);
    throw new Error(error);
  }
  return hash;
}

async function sessionFromCallback(): Promise<RestoredAuth | null> {
  const values = callbackValues(), accessToken = values.get('access_token');
  if (!accessToken) return null;
  const user = await request('/user', { headers: { authorization: `Bearer ${accessToken}` } });
  const session = normalize({
    access_token: accessToken,
    refresh_token: values.get('refresh_token') || '',
    expires_in: Number(values.get('expires_in') || 3600),
    user,
  });
  const recovery = values.get('type') === 'recovery';
  history.replaceState({}, '', location.pathname);
  return { session, recovery };
}

export const supabaseAuth = {
  async signUp(email: string, password: string, displayName: string) {
    const redirectTo = encodeURIComponent(authRedirectUrl());
    const data = await request(`/signup?redirect_to=${redirectTo}`, {
      method: 'POST',
      body: JSON.stringify({ email, password, data: { display_name: displayName.trim() } }),
    });
    return { session: normalize(data), user: data.user as AuthUser, confirmationRequired: !data.access_token };
  },

  async signIn(email: string, password: string) {
    const session = normalize(await request('/token?grant_type=password', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }));
    if (!session) throw new Error('The sign-in response did not include a session.');
    return session;
  },

  async resendConfirmation(email: string) {
    await request('/resend', {
      method: 'POST',
      body: JSON.stringify({ type: 'signup', email, email_redirect_to: authRedirectUrl() }),
    });
  },

  signInWithGoogle(redirectTo = authRedirectUrl()) {
    assertConfigured();
    const authorize = new URL(`${supabaseUrl}/auth/v1/authorize`);
    authorize.searchParams.set('provider', 'google');
    authorize.searchParams.set('redirect_to', redirectTo);
    location.assign(authorize.toString());
  },

  async sendPasswordReset(email: string, redirectTo = authRedirectUrl()) {
    await request('/recover', { method: 'POST', body: JSON.stringify({ email, redirect_to: redirectTo }) });
  },

  async updatePassword(session: AuthSession, password: string) {
    const user = await request('/user', {
      method: 'PUT',
      headers: { authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ password }),
    });
    return normalize({ ...session, user })!;
  },

  async restoreSession(): Promise<RestoredAuth> {
    const callback = await sessionFromCallback();
    if (callback) return callback;
    let saved: AuthSession | null = null;
    try { saved = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { persist(null); }
    if (!saved) return { session: null, recovery: false };
    if (saved.expires_at > Math.floor(Date.now() / 1000) + 60) return { session: saved, recovery: false };
    if (!saved.refresh_token) { persist(null); return { session: null, recovery: false }; }
    try {
      return { session: await refresh(saved), recovery: false };
    } catch {
      persist(null);
      return { session: null, recovery: false };
    }
  },

  async validSession(session: AuthSession, forceRefresh = false) {
    const expiresSoon = session.expires_at <= Math.floor(Date.now() / 1000) + 60;
    return forceRefresh || expiresSoon ? refresh(session) : session;
  },

  async signOut(session: AuthSession | null) {
    try {
      if (session?.access_token) await request('/logout', {
        method: 'POST', headers: { authorization: `Bearer ${session.access_token}` },
      });
    } finally { persist(null); }
  },
};

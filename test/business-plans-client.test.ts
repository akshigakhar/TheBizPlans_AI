import assert from 'node:assert/strict';
import test from 'node:test';
import { businessPlansClient } from '../src/lib/supabase/business-plans-client.ts';
import type { AuthSession } from '../src/lib/supabase/auth-client.ts';

test('refreshes and retries once when Supabase rejects an expired JWT', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const requests: Array<{ url: string; authorization: string | null }> = [];
  const session: AuthSession = {
    access_token: 'expired-access-token',
    refresh_token: 'refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 600,
    user: { id: 'user-1', email: 'owner@example.com' },
  };
  let restAttempts = 0;

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { setItem() {}, removeItem() {}, getItem() { return null; } },
  });
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    requests.push({ url, authorization: headers.get('authorization') });
    if (url.includes('/auth/v1/token')) {
      return Response.json({
        access_token: 'fresh-access-token', refresh_token: 'rotated-refresh-token',
        expires_in: 3600, user: session.user,
      });
    }
    restAttempts += 1;
    if (restAttempts === 1) return Response.json({ message: 'JWT expired' }, { status: 401 });
    return Response.json([]);
  };

  try {
    assert.deepEqual(await businessPlansClient.list(session), []);
    assert.equal(restAttempts, 2);
    assert.equal(requests[0].authorization, 'Bearer expired-access-token');
    assert.match(requests[1].url, /\/auth\/v1\/token\?grant_type=refresh_token$/);
    assert.equal(requests[2].authorization, 'Bearer fresh-access-token');
  } finally {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: originalStorage });
  }
});

test('refreshes a locally expired session before making a data request', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const authorizations: string[] = [];
  const session: AuthSession = {
    access_token: 'expired-access-token', refresh_token: 'refresh-token', expires_at: 0,
    user: { id: 'user-1' },
  };

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { setItem() {}, removeItem() {}, getItem() { return null; } },
  });
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes('/auth/v1/token')) {
      return Response.json({
        access_token: 'fresh-access-token', refresh_token: 'rotated-refresh-token',
        expires_in: 3600, user: session.user,
      });
    }
    authorizations.push(new Headers(init?.headers).get('authorization') || '');
    return Response.json([]);
  };

  try {
    await businessPlansClient.list(session);
    assert.deepEqual(authorizations, ['Bearer fresh-access-token']);
  } finally {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: originalStorage });
  }
});

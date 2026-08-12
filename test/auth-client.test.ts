import assert from 'node:assert/strict';
import test from 'node:test';
import { authErrorMessage } from '../src/lib/supabase/auth-client.ts';

test('replaces the Supabase confirmation-email transport error with actionable copy', () => {
  assert.equal(
    authErrorMessage({ msg: 'Error sending confirmation email' }),
    "We couldn't send your confirmation email. Please try again shortly or contact support.",
  );
  assert.equal(
    authErrorMessage({ message: 'Failed sending confirmation email' }),
    "We couldn't send your confirmation email. Please try again shortly or contact support.",
  );
});

test('preserves useful authentication errors from Supabase', () => {
  assert.equal(authErrorMessage({ message: 'User already registered' }), 'User already registered');
  assert.equal(authErrorMessage({}), 'Authentication request failed.');
});

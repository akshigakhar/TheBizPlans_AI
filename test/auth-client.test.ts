import assert from 'node:assert/strict';
import test from 'node:test';
import { authErrorMessage, isConfirmationEmailError } from '../src/lib/supabase/auth-client.ts';

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

test('identifies confirmation-email failures that can be retried', () => {
  assert.equal(isConfirmationEmailError(new Error("We couldn't send your confirmation email.")), true);
  assert.equal(isConfirmationEmailError({ message: 'Error sending confirmation email' }), true);
  assert.equal(isConfirmationEmailError(new Error('User already registered')), false);
});

test('preserves useful authentication errors from Supabase', () => {
  assert.equal(authErrorMessage({ message: 'User already registered' }), 'User already registered');
  assert.equal(authErrorMessage({}), 'Authentication request failed.');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { getPasswordChecks, isStrongPassword, PASSWORD_POLICY_MESSAGE } from '../src/utils/passwordPolicy.js';

test('password policy requires length and every character class', () => {
  assert.equal(isStrongPassword('Short1!'), false);
  assert.equal(isStrongPassword('longpassword1!'), false);
  assert.equal(isStrongPassword('Longpassword1!'), true);
  assert.deepEqual(getPasswordChecks('Longpassword1!'), {
    length: true,
    uppercase: true,
    lowercase: true,
    number: true,
    symbol: true,
  });
  assert.match(PASSWORD_POLICY_MESSAGE, /12 characters/);
});

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { getErrorPageState, getFriendlyError } from '../src/utils/errorMessages.js';

describe('actionable error messages', () => {
  test('preserves precise nested server conflict messages', () => {
    const error = {
      response: {
        status: 409,
        data: {
          success: false,
          error: { code: 'INTERNAL_SERVER_ERROR', message: 'Dr. Free Faculty is already occupied on Monday, Period 2 (09:00–09:55). Choose another available Faculty member.' },
          details: [{ facultyName: 'Dr. Free Faculty', dayOfWeek: 'monday', order: 2, startTime: '09:00', endTime: '09:55' }],
        },
      },
    };
    const message = getFriendlyError(error);
    assert.match(message, /already occupied on Monday, Period 2/);
    assert.notEqual(message, 'Something went wrong. Please try again.');
    assert.match(getErrorPageState(error).message, /already occupied/);
  });

  test('derives an actionable conflict from bounded details when the top-level message is generic', () => {
    const error = {
      response: {
        status: 409,
        data: {
          error: { code: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong on the server. Please try again later.' },
          details: [{ facultyName: 'Prof. Assigned Faculty', dayOfWeek: 'tuesday', order: 3, startTime: '10:00', endTime: '10:55' }],
        },
      },
    };
    assert.match(getFriendlyError(error), /Prof\. Assigned Faculty is already occupied on Tuesday, Period 3/);
  });

  test('preserves safe validation and payload messages before generic fallbacks', () => {
    assert.equal(getFriendlyError({ response: { status: 422, data: { error: { code: 'VALIDATION_ERROR', message: 'A class must belong to the selected department.' } } } }), 'A class must belong to the selected department.');
    assert.equal(getFriendlyError({ response: { status: 413, data: { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Image must be 3 MB or smaller.' } } } }), 'Image must be 3 MB or smaller.');
  });
});

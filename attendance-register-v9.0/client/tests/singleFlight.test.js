import test from 'node:test';
import assert from 'node:assert/strict';
import { isSingleFlightRunning, runSingleFlight } from '../src/api/singleFlight.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('single-flight shares one in-flight task across concurrent callers', async () => {
  const gate = deferred();
  let calls = 0;
  const task = () => {
    calls += 1;
    return gate.promise;
  };

  const request1 = runSingleFlight(task);
  const request2 = runSingleFlight(task);
  const request3 = runSingleFlight(task);
  await Promise.resolve();

  assert.strictEqual(request1, request2);
  assert.strictEqual(request2, request3);
  assert.equal(calls, 1);
  assert.equal(isSingleFlightRunning(), true);

  gate.resolve({ accessToken: 'next-access-token' });
  const results = await Promise.all([request1, request2, request3]);
  assert.deepEqual(results, [
    { accessToken: 'next-access-token' },
    { accessToken: 'next-access-token' },
    { accessToken: 'next-access-token' },
  ]);
  assert.equal(isSingleFlightRunning(), false);
});

test('single-flight resets after rejection and allows a later attempt', async () => {
  let calls = 0;
  await assert.rejects(
    runSingleFlight(async () => {
      calls += 1;
      throw new Error('refresh rejected');
    }),
    /refresh rejected/,
  );
  assert.equal(isSingleFlightRunning(), false);

  const result = await runSingleFlight(async () => {
    calls += 1;
    return 'recovered';
  });
  assert.equal(result, 'recovered');
  assert.equal(calls, 2);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { clearMemoryCache, memoize } from '../../server/src/utils/memoryCache.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('concurrent callers share one computation and fresh values are reused', async () => {
  clearMemoryCache();
  let runs = 0;
  const compute = async () => { runs += 1; await sleep(20); return runs; };
  const results = await Promise.all(Array.from({ length: 10 }, () => memoize('a', 1000, compute)));
  assert.deepEqual(new Set(results), new Set([1]));
  assert.equal(await memoize('a', 1000, compute), 1);
  assert.equal(runs, 1);
});

test('expired entries recompute; failures are never cached', async () => {
  clearMemoryCache();
  let runs = 0;
  await memoize('b', 10, async () => ++runs);
  await sleep(25);
  assert.equal(await memoize('b', 10, async () => ++runs), 2);
  let attempts = 0;
  await assert.rejects(memoize('c', 1000, async () => { attempts += 1; throw new Error('boom'); }));
  await sleep(5);
  assert.equal(await memoize('c', 1000, async () => { attempts += 1; return 'ok'; }), 'ok');
  assert.equal(attempts, 2);
});

test('stale-while-revalidate serves the old value at once and refreshes once in the background', async () => {
  clearMemoryCache();
  let runs = 0;
  const slow = async () => { runs += 1; const n = runs; await sleep(60); return n; };
  assert.equal(await memoize('d', 10, slow, { staleMs: 1000 }), 1);
  await sleep(20); // now stale
  const started = Date.now();
  const stale = await Promise.all([memoize('d', 10, slow, { staleMs: 1000 }), memoize('d', 10, slow, { staleMs: 1000 }), memoize('d', 10, slow, { staleMs: 1000 })]);
  assert.deepEqual(stale, [1, 1, 1]);
  assert.ok(Date.now() - started < 40, 'did not wait for the refresh');
  await sleep(120);
  assert.equal(runs, 2, 'exactly one background refresh');
  assert.equal(await memoize('d', 10, slow, { staleMs: 1000 }), 2);
});

test('a failing background refresh keeps serving the stale value', async () => {
  clearMemoryCache();
  assert.equal(await memoize('e', 5, async () => 'good', { staleMs: 1000 }), 'good');
  await sleep(15);
  assert.equal(await memoize('e', 5, async () => { throw new Error('db down'); }, { staleMs: 1000 }), 'good');
  await sleep(10);
  assert.equal(await memoize('e', 5, async () => 'recovered', { staleMs: 1000 }), 'good', 'stale served while retrying');
});

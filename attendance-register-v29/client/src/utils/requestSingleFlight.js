const inFlightRequests = new Map();

/**
 * Share an identical in-flight read request between StrictMode effects,
 * remounted components, or simultaneous consumers. The server remains the
 * authority; this only prevents duplicate client reads.
 */
export function requestSingleFlight(key, task) {
  const existing = inFlightRequests.get(key);
  if (existing) return existing;

  const promise = Promise.resolve().then(task).finally(() => {
    if (inFlightRequests.get(key) === promise) inFlightRequests.delete(key);
  });
  inFlightRequests.set(key, promise);
  return promise;
}

export function clearSingleFlightRequests() {
  inFlightRequests.clear();
}

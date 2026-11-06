let activePromise = null;

export function runSingleFlight(task) {
  if (activePromise) return activePromise;

  activePromise = Promise.resolve()
    .then(task)
    .finally(() => {
      activePromise = null;
    });

  return activePromise;
}

export function isSingleFlightRunning() {
  return Boolean(activePromise);
}

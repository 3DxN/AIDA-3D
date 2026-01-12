/**
 * Global fetch request limiter to prevent overwhelming browser connections.
 * Browsers typically limit concurrent connections per domain (usually 6).
 * This limiter ensures we don't exceed a safe number of concurrent requests.
 */

const MAX_CONCURRENT_REQUESTS = 4;

let inFlightCount = 0;
const requestQueue: Array<() => void> = [];

/**
 * Acquire a slot to make a fetch request.
 * Waits if the maximum concurrent requests are in flight.
 */
export async function acquireSlot(signal?: AbortSignal): Promise<void> {
  // Check if already aborted
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  if (inFlightCount < MAX_CONCURRENT_REQUESTS) {
    inFlightCount++;
    return;
  }

  // Wait for a slot to become available
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      const idx = requestQueue.indexOf(tryAcquire);
      if (idx !== -1) {
        requestQueue.splice(idx, 1);
      }
      reject(new DOMException('Aborted', 'AbortError'));
    };

    const tryAcquire = () => {
      signal?.removeEventListener('abort', onAbort);
      inFlightCount++;
      resolve();
    };

    signal?.addEventListener('abort', onAbort, { once: true });
    requestQueue.push(tryAcquire);
  });
}

/**
 * Release a slot after a fetch request completes.
 */
export function releaseSlot(): void {
  inFlightCount--;
  const next = requestQueue.shift();
  if (next) {
    next();
  }
}

/**
 * Get current number of in-flight requests (for debugging).
 */
export function getInFlightCount(): number {
  return inFlightCount;
}

/**
 * Get current queue length (for debugging).
 */
export function getQueueLength(): number {
  return requestQueue.length;
}

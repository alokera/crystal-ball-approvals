export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`LLM call exceeded ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Runs `fn` with an AbortSignal that fires after `ms`. Rejects with
 * TimeoutError at the deadline even if `fn` ignores the signal, so a stalled
 * upstream can never hold a request open.
 */
export async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // Reject before aborting: abort listeners reject synchronously and would
      // otherwise win the race with a generic error instead of TimeoutError.
      reject(new TimeoutError(ms));
      controller.abort();
    }, ms);
  });
  try {
    return await Promise.race([fn(controller.signal), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/** Awaits one step of an async iterator, rejecting with TimeoutError after `ms`. */
export async function nextWithin<T>(
  iterator: AsyncIterator<T>,
  ms: number,
  onTimeout: () => void,
): Promise<IteratorResult<T>> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(ms));
      onTimeout();
    }, ms);
  });
  try {
    return await Promise.race([iterator.next(), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

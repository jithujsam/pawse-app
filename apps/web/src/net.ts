/**
 * Rejects if `work` hasn't settled within `ms`, so a network call that never answers fails instead of leaving the
 * screen (or the sync loop) waiting forever. `onTimeout` runs first, so the caller can abandon the work it started.
 */
export function withTimeout<T>(work: PromiseLike<T>, ms: number, onTimeout?: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => { onTimeout?.(); reject(new Error("timed out")); }, ms);
    Promise.resolve(work).then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/** How long a sign-in, sign-out or account call may take before the app gives up and says so. */
export const NET_MS = 20_000;

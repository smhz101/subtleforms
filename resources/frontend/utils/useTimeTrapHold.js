import { useRef, useEffect, useCallback } from '@wordpress/element';
import { msUntilMinimum } from './spamToken';

/**
 * Hold a submit until the form's time trap minimum has passed (issue 126).
 * The server drops a send that comes too early and still says "Thank you", so
 * the browser waits instead. Time is counted from when the form first mounted.
 *
 * @param {number} minSeconds The form's time trap minimum, 0 when it is off.
 * @return {function(): Promise<boolean>} Resolves true when the send may go
 *   on, false when the form went away during the wait.
 */
export default function useTimeTrapHold(minSeconds) {
  const mountedAt = useRef(null);
  if (mountedAt.current === null) {
    mountedAt.current = performance.now();
  }
  const hold = useRef({ timer: null, release: null, gone: false });

  useEffect(() => {
    const h = hold.current;
    h.gone = false;
    return () => {
      h.gone = true;
      if (h.timer) clearTimeout(h.timer);
      h.timer = null;
      if (h.release) h.release();
      h.release = null;
    };
  }, []);

  return useCallback(async () => {
    const h = hold.current;
    const waitMs = msUntilMinimum(minSeconds, mountedAt.current, performance.now());
    if (waitMs > 0) {
      await new Promise((resolve) => {
        h.release = resolve;
        h.timer = setTimeout(() => {
          h.timer = null;
          h.release = null;
          resolve();
        }, waitMs);
      });
    }
    return !h.gone;
  }, [minSeconds]);
}

import { isDevBuild } from './valuePaths';

const seen = new Set();

export function warnOnce(key, ...args) {
  if (!isDevBuild()) {
    return;
  }

  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  // eslint-disable-next-line no-console
  console.warn(...args);
}

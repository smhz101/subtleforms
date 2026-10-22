/**
 * Runs first in the front-end bundle: see publicPath.js.
 */
import { chunkBase } from './publicPath';

const base = chunkBase(
  typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : '',
  typeof window !== 'undefined' ? window.subtleformsFrontend?.assetsUrl : ''
);
if (base) {
  // eslint-disable-next-line no-undef, camelcase
  __webpack_public_path__ = base;
}

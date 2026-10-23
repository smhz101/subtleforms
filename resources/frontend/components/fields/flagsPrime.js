/**
 * The "flags" group (2.7.2): downloaded only for a form with a Phone or
 * Country field that shows flags. It asks for the sprite file right away,
 * while the form loads, so the flags are drawn from the browser cache.
 */
import { flagSpriteUrl } from '../../../shared/flagSprite';

const url = flagSpriteUrl();
if (url && typeof fetch === 'function') {
  fetch(url, { credentials: 'omit' }).catch(() => {});
}

export default null;

/**
 * Country flags (2.7.2).
 *
 * Flags are SVG shapes in one sprite file, build/frontend/flags.svg, made at
 * build time (bin/build-flag-sprite.js). A flag is drawn with <use> pointing
 * at one symbol of that file, so the browser downloads and caches the file
 * once, and only for a form that turned flags on. Nothing here is emoji:
 * Windows does not draw flag emoji.
 */

const CODE = /^[A-Z]{2}$/;

/** Prefix of every symbol id in the sprite. */
export const FLAG_ID_PREFIX = 'sf-';

/** Id of the hidden copy of the sprite used when the file is on another origin. */
export const INLINE_SPRITE_ID = 'subtleforms-flag-sprite';

/**
 * A two-letter country code safe to use as a sprite fragment, or ''.
 *
 * @param {string} code Country code.
 * @return {string} Upper case code.
 */
export function flagCode(code) {
  const upper = String(code || '').toUpperCase();
  return CODE.test(upper) ? upper : '';
}

/**
 * Where the sprite file is: the front end folder on the site, or the same
 * file in the builder and the editor.
 *
 * @return {string} URL, or '' when unknown.
 */
export function flagSpriteUrl() {
  if (typeof window === 'undefined') {
    return '';
  }
  const admin = window.subtleformsAdmin?.flagSpriteUrl;
  if (typeof admin === 'string' && admin) {
    return admin;
  }
  const base = window.subtleformsFrontend?.assetsUrl;
  if (typeof base === 'string' && base) {
    return `${base.replace(/\/?$/, '/')}flags.svg`;
  }
  return '';
}

/**
 * The href of one flag's symbol.
 *
 * @param {string} code Country code.
 * @param {string} url  Sprite URL.
 * @param {boolean} inline Whether the sprite was copied into the page.
 * @return {string} href, or '' for a code that is not two letters.
 */
export function flagHref(code, url, inline = false) {
  const clean = flagCode(code);
  if (!clean || !url) {
    return '';
  }
  return `${inline ? '' : url}#${FLAG_ID_PREFIX}${clean.toLowerCase()}`;
}

/**
 * Whether the sprite lives on another origin than the page. A browser will
 * not draw <use> from another origin, so that sprite is fetched once and
 * copied into the page instead.
 *
 * @param {string}   url Sprite URL.
 * @param {Document} doc Document that draws the flags.
 * @return {boolean}
 */
export function isCrossOrigin(url, doc) {
  try {
    const base = doc?.location?.href || 'http://localhost/';
    return new URL(url, base).origin !== new URL(base).origin;
  } catch (e) {
    return false;
  }
}

const copies = new WeakMap();

/**
 * Copy the sprite into a document, once.
 *
 * @param {string}   url Sprite URL.
 * @param {Document} doc Document that draws the flags.
 * @return {Promise<void>}
 */
export function inlineSprite(url, doc) {
  if (!doc || typeof fetch !== 'function' || copies.has(doc)) {
    return copies.get(doc) || Promise.resolve();
  }
  const job = fetch(url, { credentials: 'omit' })
    .then((response) => (response.ok ? response.text() : ''))
    .then((markup) => {
      if (!markup || doc.getElementById(INLINE_SPRITE_ID)) {
        return;
      }
      const holder = doc.createElement('div');
      holder.id = INLINE_SPRITE_ID;
      holder.setAttribute('aria-hidden', 'true');
      holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      holder.innerHTML = markup;
      doc.body.appendChild(holder);
    })
    .catch(() => {
      copies.delete(doc);
    });
  copies.set(doc, job);
  return job;
}

/**
 * Forget that the sprite was copied (tests).
 *
 * @param {Document} doc Document.
 */
export function forgetInlineSprite(doc) {
  copies.delete(doc);
}

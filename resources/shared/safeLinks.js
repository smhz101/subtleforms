/**
 * Safe links in confirmation messages.
 *
 * A confirmation message is plain text. Two things in it become links:
 *
 *   [label](https://example.com/page)   a link with your own words
 *   https://example.com/page            a web address on its own
 *
 * Only http, https and site-relative addresses (starting with one slash) are
 * links. Anything else, such as javascript: or data: addresses, stays plain
 * text. Links are drawn as real elements, never as HTML, so nothing else in
 * a message can become markup.
 */

const LINK = /\[([^\]\n]{1,200})\]\(([^)\s]{1,2000})\)|https?:\/\/[^\s<>"'\])]+/g;

/**
 * The address when it is safe to link to, else an empty string.
 *
 * @param {string} url Address.
 * @return {string} The address, or ''.
 */
export function safeHref(url) {
  const href = String(url == null ? '' : url).trim();
  if (!href || href.length > 2000) return '';
  // Control characters and spaces can hide a different address from the reader.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000- \u007f-\u009f\\]/.test(href)) return '';
  if (/^https?:\/\/[^/?#]+/i.test(href)) {
    try {
      const parsed = new URL(href);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? href : '';
    } catch (e) {
      return '';
    }
  }
  // Site-relative: one leading slash, not "//host" (that is another site).
  if (href[0] === '/' && href[1] !== '/') return href;
  return '';
}

/** Whether a safe address points at another site than this page. */
export function isExternalHref(href, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  if (!/^https?:/i.test(href)) return false;
  try {
    return new URL(href).origin !== origin;
  } catch (e) {
    return true;
  }
}

/**
 * Split a message into text and link parts.
 *
 * @param {string}   text    Message with optional links.
 * @param {Function} [merge] (text, isAddress) => text. Fills merge tags. It is
 *                           applied to the parts after they are found, so an
 *                           answer typed by a visitor can never make a link.
 * @return {Array<{type: 'text', text: string}|{type: 'link', text: string, href: string}>} Parts.
 */
export function messageParts(text, merge) {
  const source = String(text == null ? '' : text);
  const fill = typeof merge === 'function' ? merge : (value) => value;
  const parts = [];
  const pushText = (value) => {
    const filled = fill(value, false);
    if (!filled) return;
    const last = parts[parts.length - 1];
    if (last && last.type === 'text') {
      last.text += filled;
    } else {
      parts.push({ type: 'text', text: filled });
    }
  };

  let index = 0;
  LINK.lastIndex = 0;
  let match;
  while ((match = LINK.exec(source)) !== null) {
    let [whole] = match;
    let label = match[1];
    let address = match[2];
    const start = match.index;
    let trailing = '';

    if (label === undefined) {
      // A bare address: a full stop or comma after it belongs to the sentence.
      const trimmed = whole.replace(/[.,;:!?]+$/, '');
      trailing = whole.slice(trimmed.length);
      whole = trimmed;
      address = trimmed;
      label = trimmed;
    }

    pushText(source.slice(index, start));
    const href = safeHref(fill(address, true));
    if (href) {
      parts.push({ type: 'link', text: fill(label, false) || href, href });
    } else {
      pushText(whole);
    }
    pushText(trailing);
    index = start + match[0].length;
  }
  pushText(source.slice(index));
  return parts;
}

/**
 * A message as paragraphs of parts. A blank line starts a new paragraph.
 *
 * @param {string}   text    Message.
 * @param {Function} [merge] See messageParts().
 * @return {Array<Array>} Paragraphs.
 */
export function messageParagraphs(text, merge) {
  return String(text == null ? '' : text)
    .split(/\n{2,}/)
    .map((paragraph) => messageParts(paragraph, merge));
}

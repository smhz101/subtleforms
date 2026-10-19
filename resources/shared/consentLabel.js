/**
 * Split a consent statement into text and one link.
 *
 * `{{link}}` is the placeholder. If the link text is already in the sentence
 * ("I agree to the Privacy Policy."), those words become the link instead of
 * being repeated after the sentence (FB-22).
 *
 * @param {string} label    Statement.
 * @param {string} url      Privacy policy URL.
 * @param {string} linkText Words that should be linked.
 * @return {Array<{text: string, url?: string}>}
 */
export function consentParts(label, url, linkText) {
  const statement = typeof label === 'string' ? label : '';
  const link = linkText || 'Privacy Policy';
  if (!url) {
    return [{ text: statement || link }];
  }
  if (!statement) {
    return [{ text: link, url }];
  }
  if (statement.includes('{{link}}')) {
    const [before, after] = statement.split('{{link}}');
    return [
      before ? { text: before } : null,
      { text: link, url },
      after ? { text: after } : null,
    ].filter(Boolean);
  }
  if (statement.includes(url)) {
    const [before, after] = statement.split(url);
    return [
      before ? { text: before } : null,
      { text: url, url },
      after ? { text: after } : null,
    ].filter(Boolean);
  }
  const at = statement.indexOf(link);
  if (at !== -1) {
    return [
      { text: statement.slice(0, at) },
      { text: link, url },
      { text: statement.slice(at + link.length) },
    ].filter((part) => part.text || part.url);
  }
  return [{ text: `${statement} ` }, { text: link, url }];
}

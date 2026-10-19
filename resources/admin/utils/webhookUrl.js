/**
 * Trim a webhook address and add https:// when no scheme was typed, so
 * "hooks.example.com/abc" works like "https://hooks.example.com/abc". The
 * server applies the same rule (Webhooks::normalizeUrl) and checks the
 * address before sending (2.4.1).
 *
 * @param {string} url Address as typed.
 * @return {string} Address with a scheme, or '' when empty.
 */
export function normalizeWebhookUrl(url) {
  const value = String(url ?? '').trim();
  if (!value || /^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    return value;
  }
  return `https://${value.replace(/^\/+/, '')}`;
}

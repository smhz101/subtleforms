import { restFetch } from './restFetch';

/** A submit token older than this (seconds) is traded for a new one before submit. */
export const REFRESH_AFTER = 3600;

/**
 * Seconds since a token or ticket was issued, read from the value itself, or
 * null when it is not in the expected shape.
 *
 * @param {string} token Value such as t1.<time>.<form id>.<signature>.
 * @param {number} now   Unix time in seconds.
 * @return {number|null} Age in seconds.
 */
export function tokenAge(token, now = Math.floor(Date.now() / 1000)) {
  const m = /^(?:t1|s[12]|v[12])\.(\d{9,11})\./.exec(String(token || ''));
  return m ? now - Number(m[1]) : null;
}

/**
 * Trade a page ticket (or an old submit token) for a per-visitor submit
 * token. Resolves to null when the exchange fails.
 *
 * @param {number} formId Form ID.
 * @param {string} token  Ticket or submit token.
 * @return {Promise<string|null>} Submit token.
 */
async function exchange(formId, token) {
  try {
    const res = await restFetch(`/forms/${formId}/spam-token`, {
      method: 'POST',
      body: { token },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const next = json?.data?.spam_token;
    return typeof next === 'string' && next ? next : null;
  } catch (e) {
    return null;
  }
}

/**
 * The page holds a render ticket that every visitor of a cached page shares,
 * so it is never sent as it is. On first interaction the ticket is traded for
 * a single-use submit token that belongs to this visitor and keeps the page's
 * render time. A submit takes that token (or trades now), retrying the trade
 * once if it failed, and each submit gets its own token.
 *
 * @param {number} formId Form ID.
 * @return {{prime: Function, take: Function}} prime(ticket) starts the trade;
 *   take(ticket, now) resolves to the token to submit.
 */
export function createSpamTokenSource(formId) {
  let held = null;

  return {
    prime(ticket) {
      if (!ticket || (held && held.ticket === ticket)) return;
      held = { ticket, promise: exchange(formId, ticket) };
    },
    async take(ticket, now) {
      if (!ticket) return ticket;
      let token = null;
      if (held && held.ticket === ticket) {
        token = await held.promise;
      }
      held = null;
      // A token held for a long time is traded again (the server expires
      // submit tokens after two hours).
      const age = tokenAge(token, now);
      if (token && age !== null && age >= REFRESH_AFTER) token = null;
      if (!token) token = await exchange(formId, ticket);
      if (!token) token = await exchange(formId, ticket);
      return token || ticket;
    },
  };
}

/**
 * One-off trade, kept for callers that have no source.
 *
 * @param {number} formId Form ID.
 * @param {string} token  Ticket from the page.
 * @param {number} now    Unix time in seconds.
 * @return {Promise<string>} Token to submit.
 */
export async function freshSpamToken(formId, token, now) {
  return createSpamTokenSource(formId).take(token, now);
}

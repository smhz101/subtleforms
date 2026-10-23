import { restFetch } from './restFetch';

/** A token older than this (seconds) is traded for a new one before submit. */
export const REFRESH_AFTER = 3600;

/**
 * Seconds since a time token was issued, read from the token itself, or null
 * when it is not in the expected shape.
 *
 * @param {string} token Token such as v1.<time>.<form id>.<signature>.
 * @param {number} now   Unix time in seconds.
 * @return {number|null} Age in seconds.
 */
export function tokenAge(token, now = Math.floor(Date.now() / 1000)) {
  const m = /^v[12]\.(\d{9,11})\./.exec(String(token || ''));
  return m ? now - Number(m[1]) : null;
}

/**
 * The time token to send with a submission. A page that was open or cached
 * for a long time holds an old token, so it is exchanged for a fresh one
 * (the server expires tokens after two hours). If the exchange fails the old
 * token is sent and the server decides.
 *
 * @param {number} formId Form ID.
 * @param {string} token  Token from the page.
 * @param {number} now    Unix time in seconds.
 * @return {Promise<string>} Token to submit.
 */
export async function freshSpamToken(formId, token, now) {
  const age = tokenAge(token, now);
  if (!token || age === null || age < REFRESH_AFTER) return token;
  try {
    const res = await restFetch(`/forms/${formId}/spam-token`, {
      method: 'POST',
      body: { token },
    });
    if (!res.ok) return token;
    const json = await res.json();
    const next = json?.data?.spam_token;
    return typeof next === 'string' && next ? next : token;
  } catch (e) {
    return token;
  }
}

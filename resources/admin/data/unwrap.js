/**
 * Unwrap the standardized `{ data, meta }` response envelope.
 *
 * Legacy responses that do not use the envelope are passed through untouched.
 * It lives in a file of its own so the preload seeding can use it without
 * loading the API client (which registers a middleware when imported).
 *
 * @param {*} response A parsed response body.
 * @return {*} The payload.
 */
export const unwrapResponse = (response) => {
  if (!response || typeof response !== 'object' || !('data' in response)) {
    return response;
  }

  const { data, meta } = response;

  if (meta?.pagination) {
    if (Array.isArray(data)) {
      return Object.assign(data, { _meta: meta, _pagination: meta.pagination });
    }
    return { ...data, _meta: meta, _pagination: meta.pagination };
  }

  return data;
};


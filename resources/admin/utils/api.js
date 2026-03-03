const getRestBase = () =>
  window.subtleformsAdmin && window.subtleformsAdmin.restUrl
    ? window.subtleformsAdmin.restUrl.replace(/\/$/, '')
    : '/wp-json/subtleforms/v1';

const getRestNonce = () =>
  window.subtleformsAdmin && window.subtleformsAdmin.restNonce
    ? window.subtleformsAdmin.restNonce
    : null;

async function parseJsonResponse(response) {
  if (!response) {
    return null;
  }

  if (response.status === 204) {
    return null;
  }

  const contentLength = response.headers?.get('Content-Length');
  if (contentLength === '0') {
    return null;
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    console.warn('Failed to parse JSON response', err);
    return null;
  }
}

export async function apiGet(path) {
  const response = await fetch(getRestBase() + path, {
    credentials: 'same-origin',
    headers: {
      'X-WP-Nonce': getRestNonce(),
      'Content-Type': 'application/json',
    },
  });

  const body = await parseJsonResponse(response);
  return { ok: response.ok, status: response.status, body };
}

export async function apiPost(path, payload) {
  const response = await fetch(getRestBase() + path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'X-WP-Nonce': getRestNonce(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await parseJsonResponse(response);
  return { ok: response.ok, status: response.status, body };
}

export async function apiPut(path, payload) {
  const response = await fetch(getRestBase() + path, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: {
      'X-WP-Nonce': getRestNonce(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await parseJsonResponse(response);
  return { ok: response.ok, status: response.status, body };
}

export async function apiDelete(path) {
  const response = await fetch(getRestBase() + path, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: {
      'X-WP-Nonce': getRestNonce(),
      'Content-Type': 'application/json',
    },
  });

  const body = await parseJsonResponse(response);
  return { ok: response.ok, status: response.status, body };
}

/**
 * Check if error is a validation error (HTTP 422)
 */
export const isValidationError = (error) => {
  return error?.status === 422 || error?.isValidationError === true;
};

/**
 * Check if error is a rate limit error (HTTP 429)
 */
export const isRateLimitError = (error) => {
  return error?.status === 429 || error?.isRateLimited === true;
};

/**
 * Check if error is a conflict error (HTTP 409)
 */
export const isConflictError = (error) => {
  return error?.status === 409 || error?.isConflict === true;
};

/**
 * Extract field errors from validation error
 */
export const getFieldErrors = (error) => {
  if (isValidationError(error)) {
    return error?.fields || {};
  }
  return {};
};

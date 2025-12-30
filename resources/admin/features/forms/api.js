/**
 * Forms Feature API
 *
 * All form-related API calls.
 */

import { apiGet, apiPost, apiPut } from '../../utils/api';

export async function getForms() {
  return await apiGet('/forms');
}

export async function getForm(id) {
  return await apiGet(`/forms/${id}`);
}

export async function createForm(data) {
  return await apiPost('/forms', data);
}

export async function updateForm(id, data) {
  return await apiPut(`/forms/${id}`, data);
}

export async function deleteForm(id) {
  const response = await fetch(
    window.subtleformsAdmin.restUrl.replace(/\/$/, '') + `/forms/${id}`,
    {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: {
        'X-WP-Nonce': window.subtleformsAdmin.restNonce,
        'Content-Type': 'application/json',
      },
    }
  );

  const body = await response.json().catch(() => null);
  return { ok: response.ok, body };
}

export async function getFormSchema(formId) {
  return await apiGet(`/forms/${formId}/schema?context=builder`);
}

export async function saveFormSchema(formId, schema) {
  return await apiPost(`/forms/${formId}/schema`, schema);
}

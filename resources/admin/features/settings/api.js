/**
 * Settings Feature API
 *
 * All settings-related API calls.
 */

import apiFetch from '@wordpress/api-fetch';

export async function getSettings() {
  return await apiFetch({
    path: '/subtleforms/v1/settings',
    method: 'GET',
  });
}

export async function saveSettings(settings) {
  return await apiFetch({
    path: '/subtleforms/v1/settings',
    method: 'PUT',
    data: settings,
  });
}

export async function resetSettings() {
  return await apiFetch({
    path: '/subtleforms/v1/settings/reset',
    method: 'POST',
  });
}

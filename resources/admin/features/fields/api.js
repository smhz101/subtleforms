/**
 * Fields Feature API
 *
 * All field-related API calls.
 */

import { apiGet } from '../../utils/api';

export async function getFields(grouped = false) {
  const path = grouped ? '/fields?grouped=true' : '/fields';
  return await apiGet(path);
}

export async function getFieldDefinitions() {
  return await apiGet('/fields');
}

/**
 * Shared Group Field Factories
 * Grouped field builders (name, address)
 */

import { __ } from '@wordpress/i18n';

/**
 * Name group factory
 */
export function nameGroup({
  key = 'name_group',
  label = __('Full Name', 'subtleforms'),
  required = true,
  enable_middle_name = false,
  enable_suffix = false,
  ...rest
}) {
  return {
    type: 'name_group',
    key,
    label,
    required,
    enable_middle_name,
    enable_suffix,
    ...rest,
  };
}

/**
 * Address group factory
 */
export function addressGroup({
  key = 'address_group',
  label = __('Address', 'subtleforms'),
  required = false,
  enable_street2 = false,
  enable_state = true,
  enable_postal = true,
  enable_country = true,
  ...rest
}) {
  return {
    type: 'address_group',
    key,
    label,
    required,
    enable_street2,
    enable_state,
    enable_postal,
    enable_country,
    ...rest,
  };
}

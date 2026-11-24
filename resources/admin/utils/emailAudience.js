/**
 * Who an email notification writes to, judged from its unreplaced To value.
 * Mirrors EmailAction::audience() in PHP: a To built from an answer tag such
 * as {email} or {{field:email}} goes to the person who filled in the form;
 * a fixed address or {admin_email} is a notification for the site owner.
 *
 * @param {*} to The To setting before tags are replaced.
 * @return {'admin'|'submitter'} Audience.
 */
export function emailAudience( to ) {
  if ( typeof to !== 'string' ) {
    return 'admin';
  }
  const withoutSiteTags = to.replace( /\{\{?\s*(admin_email|site_name|form_title|entry_id|date)\s*\}?\}/g, '' );
  return /\{\{?\s*(field:)?[a-zA-Z0-9_]+\s*\}?\}/.test( withoutSiteTags ) ? 'submitter' : 'admin';
}

/**
 * The Settings, Email switch that stops this audience from being sent, or
 * null when it is on. A missing admin switch counts as on, like PHP.
 *
 * @param {'admin'|'submitter'} audience Audience.
 * @param {Object|null} settings Site settings, or null while not loaded.
 * @return {string|null} Warning kind: 'submitter_off', 'admin_off' or null.
 */
export function emailSwitchOff( audience, settings ) {
  if ( ! settings || typeof settings !== 'object' ) {
    return null;
  }
  if ( audience === 'submitter' ) {
    return settings.user_confirmation_enabled ? null : 'submitter_off';
  }
  if ( Object.prototype.hasOwnProperty.call( settings, 'admin_notification_enabled' ) ) {
    return settings.admin_notification_enabled ? null : 'admin_off';
  }
  return null;
}

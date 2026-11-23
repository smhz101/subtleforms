/**
 * Whether a stored on/off value is on. The server and older code send the
 * same flag as 1, "1", true or "true"; anything else is off.
 *
 * @param {*} value Flag as received.
 * @return {boolean} True when on.
 */
export function isOn(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

export default isOn;

export function toggleIsOn(value, config = {}) {
  const offValue = config.offValue ?? 'no';
  const onValue = config.onValue ?? 'yes';
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  const normalized = String(value).trim().toLowerCase();
  const off = String(offValue).trim().toLowerCase();
  if (
    normalized === off ||
    normalized === '0' ||
    normalized === 'off' ||
    normalized === 'false' ||
    normalized === 'no' ||
    normalized === 'disabled'
  ) {
    return false;
  }
  const on = String(onValue).trim().toLowerCase();
  if (
    normalized === on ||
    normalized === '1' ||
    normalized === 'on' ||
    normalized === 'true' ||
    normalized === 'yes' ||
    normalized === 'enabled'
  ) {
    return true;
  }
  return false;
}

export function toggleInitialValue(config = {}) {
  const onValue = config.onValue ?? 'yes';
  const offValue = config.offValue ?? 'no';
  const state = config.defaultState;
  if (state === undefined || state === null || state === '') {
    return offValue;
  }
  return toggleIsOn(state, { onValue: 'on', offValue: 'off' }) ? onValue : offValue;
}

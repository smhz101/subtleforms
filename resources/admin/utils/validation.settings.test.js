import { validateField, validateSettings } from './validation';

function validSettings(overrides = {}) {
  return {
    default_form_status: 'draft',
    autosave_enabled: true,
    autosave_interval: 4,
    delete_behavior: 'soft',
    success_message: 'ok',
    error_message: 'err',
    submission_limit_enabled: false,
    submission_limit: 1,
    admin_notification_enabled: true,
    user_confirmation_enabled: false,
    debug_mode: false,
    captcha_enabled: false,
    sender_email: '',
    admin_email: '',
    entries_trash_days: 30,
    ...overrides,
  };
}

describe('settings save validation', () => {
  test.each([1, 4, 60])('accepts autosave_interval %s', (interval) => {
    const { isValid } = validateSettings(
      validSettings({ autosave_interval: interval })
    );
    expect(isValid).toBe(true);
  });

  test.each([0, 61])('rejects autosave_interval %s', (interval) => {
    const { isValid, errors } = validateSettings(
      validSettings({ autosave_interval: interval })
    );
    expect(isValid).toBe(false);
    expect(errors.autosave_interval.join(' ')).toMatch(/Autosave Interval/);
  });

  test('validateField names Autosave Interval', () => {
    expect(validateField('autosave_interval', 0).error).toMatch(/Autosave Interval/);
    expect(validateField('autosave_interval', 61).error).toMatch(/Autosave Interval/);
    expect(validateField('autosave_interval', 4).isValid).toBe(true);
  });

  test('empty sender and admin emails are valid', () => {
    const { isValid } = validateSettings(
      validSettings({
        autosave_interval: 4,
        entries_trash_days: 30,
        sender_email: '',
        admin_email: '',
      })
    );
    expect(isValid).toBe(true);
  });

  test('rejects an unknown reading pane', () => {
    const { isValid, errors } = validateSettings(
      validSettings({ submissions_reading_pane: 'left' })
    );
    expect(isValid).toBe(false);
    expect(errors.submissions_reading_pane.join(' ')).toMatch(/Reading pane/);
  });
});

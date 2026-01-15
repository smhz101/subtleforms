import { useState, useEffect } from '@wordpress/element';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  TextControl,
  ToggleControl,
  SelectControl,
  Notice,
  Spinner,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { validateSettings, validateField } from '../utils/validation';
import AdminShell from '../components/AdminShell';
import './SettingsPage.scss';

/**
 * Field Error Display Component
 */
function FieldError({ errors }) {
  if (!errors || errors.length === 0) {
    return null;
  }

  return (
    <div className='subtleforms-field-error'>
      {errors.map((error, index) => (
        <span key={index} className='sf-error-text'>
          {error}
        </span>
      ))}
    </div>
  );
}

/**
 * Settings Page Component
 */
export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [activeTab, setActiveTab] = useState('general');

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await apiFetch({
        path: '/subtleforms/v1/settings',
        method: 'GET',
      });

      if (response.success) {
        // Ensure boolean values are properly typed
        const normalizedSettings = {
          ...response.data,
          autosave_enabled: Boolean(response.data.autosave_enabled),
          submission_limit_enabled: Boolean(
            response.data.submission_limit_enabled
          ),
          admin_notification_enabled: Boolean(
            response.data.admin_notification_enabled
          ),
          user_confirmation_enabled: Boolean(
            response.data.user_confirmation_enabled
          ),
          debug_mode: Boolean(response.data.debug_mode),
          captcha_enabled: Boolean(response.data.captcha_enabled),
        };
        setSettings(normalizedSettings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      setMessage({
        type: 'error',
        text: __('Failed to load settings. Please try again.', 'subtleforms'),
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = (key, value) => {
    // Ensure integers are properly converted
    let finalValue = value;
    if (
      key === 'autosave_interval' ||
      key === 'submission_limit' ||
      key === 'log_retention_days'
    ) {
      finalValue = parseInt(value, 10);
      if (isNaN(finalValue)) {
        // Set field error and don't update
        setFieldErrors((prev) => ({
          ...prev,
          [key]: [__('Must be a valid number', 'subtleforms')],
        }));
        return;
      }
    }

    // Validate the field
    const { isValid, error } = validateField(key, finalValue);

    // Update field errors
    setFieldErrors((prev) => ({
      ...prev,
      [key]: isValid ? [] : [error],
    }));

    setSettings((prev) => ({
      ...prev,
      [key]: finalValue,
    }));
    setHasChanges(true);
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setMessage(null);
      setFieldErrors({});

      // Ensure all integer fields are properly formatted
      const settingsToSave = {
        ...settings,
        autosave_interval: parseInt(settings.autosave_interval, 10) || 3,
        submission_limit: parseInt(settings.submission_limit, 10) || 1,
        log_retention_days: parseInt(settings.log_retention_days, 10) || 30,
      };

      // Validate all settings with Joi
      const { isValid, errors } = validateSettings(settingsToSave);

      if (!isValid) {
        setFieldErrors(errors);
        setMessage({
          type: 'error',
          text: __(
            'Please fix the validation errors below before saving.',
            'subtleforms'
          ),
        });
        return;
      }

      const response = await apiFetch({
        path: '/subtleforms/v1/settings',
        method: 'PUT',
        data: settingsToSave,
      });

      if (response.success) {
        setMessage({
          type: 'success',
          text:
            response.message ||
            __('Settings saved successfully!', 'subtleforms'),
        });
        setHasChanges(false);
        // Ensure boolean values are properly typed after save
        const normalizedSettings = {
          ...response.data,
          autosave_enabled: Boolean(response.data.autosave_enabled),
          submission_limit_enabled: Boolean(
            response.data.submission_limit_enabled
          ),
          admin_notification_enabled: Boolean(
            response.data.admin_notification_enabled
          ),
          user_confirmation_enabled: Boolean(
            response.data.user_confirmation_enabled
          ),
          debug_mode: Boolean(response.data.debug_mode),
        };
        setSettings(normalizedSettings);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      setMessage({
        type: 'error',
        text:
          error.message ||
          __('Failed to save settings. Please try again.', 'subtleforms'),
      });
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = async () => {
    if (
      !confirm(
        __(
          'Are you sure you want to reset all settings to defaults? This cannot be undone.',
          'subtleforms'
        )
      )
    ) {
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      const response = await apiFetch({
        path: '/subtleforms/v1/settings/reset',
        method: 'POST',
      });

      if (response.success) {
        setMessage({
          type: 'success',
          text:
            response.message ||
            __('Settings reset successfully!', 'subtleforms'),
        });
        // Ensure boolean values are properly typed after reset
        const normalizedSettings = {
          ...response.data,
          autosave_enabled: Boolean(response.data.autosave_enabled),
          submission_limit_enabled: Boolean(
            response.data.submission_limit_enabled
          ),
          admin_notification_enabled: Boolean(
            response.data.admin_notification_enabled
          ),
          user_confirmation_enabled: Boolean(
            response.data.user_confirmation_enabled
          ),
          debug_mode: Boolean(response.data.debug_mode),
        };
        setSettings(normalizedSettings);
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Failed to reset settings:', error);
      setMessage({
        type: 'error',
        text: __('Failed to reset settings. Please try again.', 'subtleforms'),
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminShell title={__('Settings', 'subtleforms')}>
        <div className='subtleforms-settings-loading'>
          <Spinner />
          <p>{__('Loading settings...', 'subtleforms')}</p>
        </div>
      </AdminShell>
    );
  }

  if (!settings) {
    return (
      <AdminShell title={__('Settings', 'subtleforms')}>
        <div className='subtleforms-settings-error'>
          <Notice status='error' isDismissible={false}>
            {__('Failed to load settings.', 'subtleforms')}
          </Notice>
          <Button variant='primary' onClick={loadSettings}>
            {__('Retry', 'subtleforms')}
          </Button>
        </div>
      </AdminShell>
    );
  }

  const tabs = [
    {
      name: 'general',
      title: __('General', 'subtleforms'),
      icon: 'admin-settings',
    },
    {
      name: 'frontend',
      title: __('Frontend', 'subtleforms'),
      icon: 'admin-appearance',
    },
    {
      name: 'email',
      title: __('Email / Notifications', 'subtleforms'),
      icon: 'email',
    },
    {
      name: 'advanced',
      title: __('Advanced', 'subtleforms'),
      icon: 'admin-tools',
    },
  ];

  const actions = (
    <>
      {hasChanges && (
        <Button variant='secondary' onClick={loadSettings} disabled={saving}>
          {__('Discard Changes', 'subtleforms')}
        </Button>
      )}
      <Button
        variant='primary'
        onClick={saveSettings}
        isBusy={saving}
        disabled={saving || !hasChanges}>
        {saving
          ? __('Saving...', 'subtleforms')
          : __('Save Settings', 'subtleforms')}
      </Button>
    </>
  );

  return (
    <AdminShell title={__('Settings', 'subtleforms')} actions={actions}>
      <div className='sf-settings-container'>
        {/* Messages */}
        {message && (
          <Notice
            status={message.type}
            isDismissible
            onRemove={() => setMessage(null)}
            className='sf-settings-notice'>
            {message.text}
          </Notice>
        )}

        {/* Two-Column Layout: Sidebar + Content */}
        <div className='sf-settings-layout'>
          {/* Sidebar Navigation */}
          <nav className='sf-settings-sidebar'>
            <ul className='sf-settings-nav'>
              {tabs.map((tab) => (
                <li key={tab.name}>
                  <button
                    type='button'
                    className={`sf-settings-nav-item ${
                      activeTab === tab.name
                        ? 'sf-settings-nav-item--active'
                        : ''
                    }`}
                    onClick={() => setActiveTab(tab.name)}>
                    <span className={`dashicons dashicons-${tab.icon}`} />
                    <span className='sf-settings-nav-item__label'>
                      {tab.title}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Content Area */}
          <div className='sf-settings-content'>
            {activeTab === 'general' && (
              <GeneralSettings
                settings={settings}
                updateSetting={updateSetting}
                fieldErrors={fieldErrors}
              />
            )}
            {activeTab === 'frontend' && (
              <FrontendSettings
                settings={settings}
                updateSetting={updateSetting}
                fieldErrors={fieldErrors}
              />
            )}
            {activeTab === 'email' && (
              <EmailSettings
                settings={settings}
                updateSetting={updateSetting}
                fieldErrors={fieldErrors}
              />
            )}
            {activeTab === 'advanced' && (
              <AdvancedSettings
                settings={settings}
                updateSetting={updateSetting}
                resetSettings={resetSettings}
                saving={saving}
                fieldErrors={fieldErrors}
              />
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

// General Settings Tab
function GeneralSettings({ settings, updateSetting, fieldErrors = {} }) {
  return (
    <Card>
      <CardBody>
        <div className='sf-settings-section'>
          <div>
            <SelectControl
              label={__('Default New Form Status', 'subtleforms')}
              value={settings.default_form_status}
              options={[
                { label: __('Draft', 'subtleforms'), value: 'draft' },
                { label: __('Published', 'subtleforms'), value: 'published' },
              ]}
              onChange={(value) => updateSetting('default_form_status', value)}
              help={__('Default status when creating new forms', 'subtleforms')}
            />
            <FieldError errors={fieldErrors.default_form_status} />
          </div>

          <div>
            <ToggleControl
              label={__('Enable Autosave', 'subtleforms')}
              checked={settings.autosave_enabled}
              onChange={(value) => updateSetting('autosave_enabled', value)}
              help={__(
                'Automatically save form changes while editing',
                'subtleforms'
              )}
            />
            <FieldError errors={fieldErrors.autosave_enabled} />
          </div>

          {settings.autosave_enabled && (
            <div>
              <TextControl
                label={__('Autosave Interval (seconds)', 'subtleforms')}
                type='number'
                value={String(settings.autosave_interval)}
                onChange={(value) => updateSetting('autosave_interval', value)}
                min='1'
                max='60'
                help={__(
                  'Time between autosave triggers (1-60 seconds)',
                  'subtleforms'
                )}
              />
              <FieldError errors={fieldErrors.autosave_interval} />
            </div>
          )}

          <div>
            <SelectControl
              label={__('Delete Behavior', 'subtleforms')}
              value={settings.delete_behavior}
              options={[
                {
                  label: __('Soft Delete (Move to Trash)', 'subtleforms'),
                  value: 'soft',
                },
                {
                  label: __('Hard Delete (Permanent)', 'subtleforms'),
                  value: 'hard',
                },
              ]}
              onChange={(value) => updateSetting('delete_behavior', value)}
              help={__('How forms and submissions are deleted', 'subtleforms')}
            />
            <FieldError errors={fieldErrors.delete_behavior} />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// Frontend Settings Tab
function FrontendSettings({ settings, updateSetting, fieldErrors = {} }) {
  return (
    <Card>
      <CardBody>
        <div className='sf-settings-section'>
          <div>
            <TextControl
              label={__('Success Message', 'subtleforms')}
              value={settings.success_message}
              onChange={(value) => updateSetting('success_message', value)}
              help={__(
                'Message shown after successful submission',
                'subtleforms'
              )}
            />
            <FieldError errors={fieldErrors.success_message} />
          </div>

          <div>
            <TextControl
              label={__('Error Message', 'subtleforms')}
              value={settings.error_message}
              onChange={(value) => updateSetting('error_message', value)}
              help={__(
                'Generic error message shown on submission failure',
                'subtleforms'
              )}
            />
            <FieldError errors={fieldErrors.error_message} />
          </div>

          <div>
            <TextControl
              label={__('Redirect After Submit (URL)', 'subtleforms')}
              value={settings.redirect_after_submit}
              onChange={(value) =>
                updateSetting('redirect_after_submit', value)
              }
              help={__(
                'Optional URL to redirect after submission (leave empty to show message)',
                'subtleforms'
              )}
              placeholder='https://example.com/thank-you'
            />
            <FieldError errors={fieldErrors.redirect_after_submit} />
          </div>

          <div>
            <ToggleControl
              label={__('Enable Submission Limit', 'subtleforms')}
              checked={settings.submission_limit_enabled}
              onChange={(value) =>
                updateSetting('submission_limit_enabled', value)
              }
              help={__('Limit submissions per user/IP address', 'subtleforms')}
            />
            <FieldError errors={fieldErrors.submission_limit_enabled} />
          </div>

          {settings.submission_limit_enabled && (
            <div>
              <TextControl
                label={__('Maximum Submissions', 'subtleforms')}
                type='number'
                value={String(settings.submission_limit)}
                onChange={(value) => updateSetting('submission_limit', value)}
                min='1'
                max='100'
                help={__(
                  'Maximum number of submissions allowed per user',
                  'subtleforms'
                )}
              />
              <FieldError errors={fieldErrors.submission_limit} />
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

// Email Settings Tab
function EmailSettings({ settings, updateSetting, fieldErrors = {} }) {
  return (
    <Card>
      <CardBody>
        <div className='sf-settings-section'>
          <div>
            <ToggleControl
              label={__('Admin Notifications', 'subtleforms')}
              checked={settings.admin_notification_enabled}
              onChange={(value) =>
                updateSetting('admin_notification_enabled', value)
              }
              help={__('Send email to admin on new submissions', 'subtleforms')}
            />
            <FieldError errors={fieldErrors.admin_notification_enabled} />
          </div>

          <div>
            <ToggleControl
              label={__('User Confirmation Emails', 'subtleforms')}
              checked={settings.user_confirmation_enabled}
              onChange={(value) =>
                updateSetting('user_confirmation_enabled', value)
              }
              help={__(
                'Send confirmation email to users after submission',
                'subtleforms'
              )}
            />
            <FieldError errors={fieldErrors.user_confirmation_enabled} />
          </div>

          <div>
            <TextControl
              label={__('Sender Name', 'subtleforms')}
              value={settings.sender_name}
              onChange={(value) => updateSetting('sender_name', value)}
              help={__(
                'Email sender name (leave empty for site name)',
                'subtleforms'
              )}
              placeholder={
                window.subtleformsData?.siteName ||
                __('Your Site', 'subtleforms')
              }
            />
            <FieldError errors={fieldErrors.sender_name} />
          </div>

          <div>
            <TextControl
              label={__('Sender Email', 'subtleforms')}
              type='email'
              value={settings.sender_email}
              onChange={(value) => updateSetting('sender_email', value)}
              help={__(
                'Email sender address (leave empty for admin email)',
                'subtleforms'
              )}
              placeholder={
                window.subtleformsData?.adminEmail || 'admin@example.com'
              }
            />
            <FieldError errors={fieldErrors.sender_email} />
          </div>

          <div>
            <TextControl
              label={__('Admin Email', 'subtleforms')}
              type='email'
              value={settings.admin_email}
              onChange={(value) => updateSetting('admin_email', value)}
              help={__(
                'Email to receive admin notifications (leave empty for WordPress admin email)',
                'subtleforms'
              )}
              placeholder={
                window.subtleformsData?.adminEmail || 'admin@example.com'
              }
            />
            <FieldError errors={fieldErrors.admin_email} />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// Advanced Settings Tab
function AdvancedSettings({
  settings,
  updateSetting,
  resetSettings,
  saving,
  fieldErrors = {},
}) {
  return (
    <Card>
      <CardBody>
        <div className='sf-settings-section'>
          <div>
            <ToggleControl
              label={__('Debug Mode', 'subtleforms')}
              checked={settings.debug_mode}
              onChange={(value) => updateSetting('debug_mode', value)}
              help={__(
                'Enable detailed logging for troubleshooting',
                'subtleforms'
              )}
            />
            <FieldError errors={fieldErrors.debug_mode} />
          </div>

          <div>
            <TextControl
              label={__('Log Retention (days)', 'subtleforms')}
              type='number'
              value={String(settings.log_retention_days)}
              onChange={(value) => updateSetting('log_retention_days', value)}
              min='1'
              max='365'
              help={__(
                'How long to keep submission logs (1-365 days)',
                'subtleforms'
              )}
            />
            <FieldError errors={fieldErrors.log_retention_days} />
          </div>

          <div>
            <h4 className='sf-section-title'>
              {__('Spam Protection', 'subtleforms')}
            </h4>
            <ToggleControl
              label={__('Enable Honeypot Protection', 'subtleforms')}
              checked={settings.enable_honeypot ?? true}
              onChange={(value) => updateSetting('enable_honeypot', value)}
              help={__(
                'Adds invisible fields to detect and block spam bots',
                'subtleforms'
              )}
            />
            <FieldError errors={fieldErrors.enable_honeypot} />
          </div>

          <div>
            <TextControl
              label={__('Minimum Submission Time (seconds)', 'subtleforms')}
              type='number'
              value={String(settings.min_submission_time ?? 3)}
              onChange={(value) =>
                updateSetting('min_submission_time', parseInt(value))
              }
              min='0'
              max='60'
              help={__(
                'Minimum time required before form submission (prevents instant bot submissions)',
                'subtleforms'
              )}
            />
            <FieldError errors={fieldErrors.min_submission_time} />
          </div>

          <div>
            <h4 className='sf-section-title'>{__('CAPTCHA', 'subtleforms')}</h4>
            <ToggleControl
              label={__('Enable CAPTCHA', 'subtleforms')}
              checked={settings.captcha_enabled ?? false}
              onChange={(value) => updateSetting('captcha_enabled', value)}
              help={__(
                'Require CAPTCHA verification on forms to prevent spam and bot submissions',
                'subtleforms'
              )}
            />
            <FieldError errors={fieldErrors.captcha_enabled} />
          </div>

          {settings.captcha_enabled && (
            <>
              <div>
                <SelectControl
                  label={__('CAPTCHA Provider', 'subtleforms')}
                  value={settings.captcha_provider ?? ''}
                  onChange={(value) => updateSetting('captcha_provider', value)}
                  options={[
                    {
                      label: __('-- Select Provider --', 'subtleforms'),
                      value: '',
                    },
                    { label: 'Google reCAPTCHA', value: 'recaptcha' },
                    { label: 'hCaptcha', value: 'hcaptcha' },
                    { label: 'Cloudflare Turnstile', value: 'turnstile' },
                  ]}
                  help={__(
                    'Choose which CAPTCHA service to use',
                    'subtleforms'
                  )}
                />
                <FieldError errors={fieldErrors.captcha_provider} />
              </div>

              {settings.captcha_provider === 'recaptcha' && (
                <>
                  <div>
                    <SelectControl
                      label={__('reCAPTCHA Version', 'subtleforms')}
                      value={settings.captcha_recaptcha_version ?? 'v2'}
                      onChange={(value) =>
                        updateSetting('captcha_recaptcha_version', value)
                      }
                      options={[
                        { label: 'v2 (Checkbox)', value: 'v2' },
                        { label: 'v3 (Invisible)', value: 'v3' },
                      ]}
                    />
                    <FieldError
                      errors={fieldErrors.captcha_recaptcha_version}
                    />
                  </div>
                  <div>
                    <TextControl
                      label={__('Site Key', 'subtleforms')}
                      value={settings.captcha_recaptcha_site_key ?? ''}
                      onChange={(value) =>
                        updateSetting('captcha_recaptcha_site_key', value)
                      }
                      help={__(
                        'Get your keys from https://www.google.com/recaptcha/admin',
                        'subtleforms'
                      )}
                    />
                    <FieldError
                      errors={fieldErrors.captcha_recaptcha_site_key}
                    />
                  </div>
                  <div>
                    <TextControl
                      label={__('Secret Key', 'subtleforms')}
                      type='password'
                      value={settings.captcha_recaptcha_secret_key ?? ''}
                      onChange={(value) =>
                        updateSetting('captcha_recaptcha_secret_key', value)
                      }
                    />
                    <FieldError
                      errors={fieldErrors.captcha_recaptcha_secret_key}
                    />
                  </div>
                </>
              )}

              {settings.captcha_provider === 'hcaptcha' && (
                <>
                  <div>
                    <TextControl
                      label={__('Site Key', 'subtleforms')}
                      value={settings.captcha_hcaptcha_site_key ?? ''}
                      onChange={(value) =>
                        updateSetting('captcha_hcaptcha_site_key', value)
                      }
                      help={__(
                        'Get your keys from https://dashboard.hcaptcha.com/',
                        'subtleforms'
                      )}
                    />
                    <FieldError
                      errors={fieldErrors.captcha_hcaptcha_site_key}
                    />
                  </div>
                  <div>
                    <TextControl
                      label={__('Secret Key', 'subtleforms')}
                      type='password'
                      value={settings.captcha_hcaptcha_secret_key ?? ''}
                      onChange={(value) =>
                        updateSetting('captcha_hcaptcha_secret_key', value)
                      }
                    />
                    <FieldError
                      errors={fieldErrors.captcha_hcaptcha_secret_key}
                    />
                  </div>
                </>
              )}

              {settings.captcha_provider === 'turnstile' && (
                <>
                  <div>
                    <TextControl
                      label={__('Site Key', 'subtleforms')}
                      value={settings.captcha_turnstile_site_key ?? ''}
                      onChange={(value) =>
                        updateSetting('captcha_turnstile_site_key', value)
                      }
                      help={__(
                        'Get your keys from https://dash.cloudflare.com/?to=/:account/turnstile',
                        'subtleforms'
                      )}
                    />
                    <FieldError
                      errors={fieldErrors.captcha_turnstile_site_key}
                    />
                  </div>
                  <div>
                    <TextControl
                      label={__('Secret Key', 'subtleforms')}
                      type='password'
                      value={settings.captcha_turnstile_secret_key ?? ''}
                      onChange={(value) =>
                        updateSetting('captcha_turnstile_secret_key', value)
                      }
                    />
                    <FieldError
                      errors={fieldErrors.captcha_turnstile_secret_key}
                    />
                  </div>
                </>
              )}
            </>
          )}

          <div>
            <h4 className='sf-section-title'>
              {__('Privacy & GDPR', 'subtleforms')}
            </h4>
            <TextControl
              label={__('Data Retention Period (days)', 'subtleforms')}
              type='number'
              value={String(settings.data_retention_days ?? 0)}
              onChange={(value) =>
                updateSetting('data_retention_days', parseInt(value))
              }
              min='0'
              max='3650'
              help={__(
                'Automatically delete submissions older than this many days. Set to 0 to keep submissions forever. Recommended: 365-730 days for GDPR compliance.',
                'subtleforms'
              )}
            />
            <FieldError errors={fieldErrors.data_retention_days} />
            <p className='sf-section-description'>
              {__(
                'Note: Submissions can also be exported or erased via WordPress Privacy Tools (Tools → Export/Erase Personal Data).',
                'subtleforms'
              )}
            </p>
          </div>

          <div className='subtleforms-settings-danger-zone'>
            <h3>{__('Danger Zone', 'subtleforms')}</h3>
            <p>
              {__(
                'Resetting will restore all settings to their default values. This action cannot be undone.',
                'subtleforms'
              )}
            </p>
            <Button
              variant='tertiary'
              isDestructive
              onClick={resetSettings}
              disabled={saving}>
              {__('Reset All Settings', 'subtleforms')}
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

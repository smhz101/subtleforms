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
  TabPanel,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import './SettingsPage.css';

/**
 * Settings Page Component
 */
export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

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
          submission_limit_enabled: Boolean(response.data.submission_limit_enabled),
          admin_notification_enabled: Boolean(response.data.admin_notification_enabled),
          user_confirmation_enabled: Boolean(response.data.user_confirmation_enabled),
          debug_mode: Boolean(response.data.debug_mode),
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
        return; // Don't update with invalid number
      }
    }

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

      // Ensure all integer fields are properly formatted
      const settingsToSave = {
        ...settings,
        autosave_interval: parseInt(settings.autosave_interval, 10),
        submission_limit: parseInt(settings.submission_limit, 10),
        log_retention_days: parseInt(settings.log_retention_days, 10),
      };

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
          submission_limit_enabled: Boolean(response.data.submission_limit_enabled),
          admin_notification_enabled: Boolean(response.data.admin_notification_enabled),
          user_confirmation_enabled: Boolean(response.data.user_confirmation_enabled),
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
          submission_limit_enabled: Boolean(response.data.submission_limit_enabled),
          admin_notification_enabled: Boolean(response.data.admin_notification_enabled),
          user_confirmation_enabled: Boolean(response.data.user_confirmation_enabled),
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
      <div className='subtleforms-settings-loading'>
        <Spinner />
        <p>{__('Loading settings...', 'subtleforms')}</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className='subtleforms-settings-error'>
        <Notice status='error' isDismissible={false}>
          {__('Failed to load settings.', 'subtleforms')}
        </Notice>
        <Button variant='primary' onClick={loadSettings}>
          {__('Retry', 'subtleforms')}
        </Button>
      </div>
    );
  }

  const tabs = [
    {
      name: 'general',
      title: __('General', 'subtleforms'),
      className: 'subtleforms-settings-tab',
    },
    {
      name: 'frontend',
      title: __('Frontend', 'subtleforms'),
      className: 'subtleforms-settings-tab',
    },
    {
      name: 'email',
      title: __('Email / Notifications', 'subtleforms'),
      className: 'subtleforms-settings-tab',
    },
    {
      name: 'advanced',
      title: __('Advanced', 'subtleforms'),
      className: 'subtleforms-settings-tab',
    },
  ];

  return (
    <div className='subtleforms-settings'>
      {/* Header with Save/Discard buttons */}
      <div className='subtleforms-settings-header'>
        <h1 className='wp-heading-inline'>{__('Settings', 'subtleforms')}</h1>
        <div className='subtleforms-settings-actions'>
          {hasChanges && (
            <Button
              variant='secondary'
              onClick={loadSettings}
              disabled={saving}>
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
        </div>
      </div>

      {/* Messages */}
      {message && (
        <Notice
          status={message.type}
          isDismissible
          onRemove={() => setMessage(null)}
          className='subtleforms-settings-notice'>
          {message.text}
        </Notice>
      )}

      {/* Tabbed Content */}
      <TabPanel
        className='subtleforms-settings-tabs'
        activeClass='is-active'
        tabs={tabs}>
        {(tab) => (
          <div className='subtleforms-settings-tab-content'>
            {tab.name === 'general' && (
              <GeneralSettings
                settings={settings}
                updateSetting={updateSetting}
              />
            )}
            {tab.name === 'frontend' && (
              <FrontendSettings
                settings={settings}
                updateSetting={updateSetting}
              />
            )}
            {tab.name === 'email' && (
              <EmailSettings
                settings={settings}
                updateSetting={updateSetting}
              />
            )}
            {tab.name === 'advanced' && (
              <AdvancedSettings
                settings={settings}
                updateSetting={updateSetting}
                resetSettings={resetSettings}
                saving={saving}
              />
            )}
          </div>
        )}
      </TabPanel>
    </div>
  );
}

// General Settings Tab
function GeneralSettings({ settings, updateSetting }) {
  return (
    <Card>
      <CardBody>
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

        <ToggleControl
          label={__('Enable Autosave', 'subtleforms')}
          checked={settings.autosave_enabled}
          onChange={(value) => updateSetting('autosave_enabled', value)}
          help={__(
            'Automatically save form changes while editing',
            'subtleforms'
          )}
        />

        {settings.autosave_enabled && (
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
        )}

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
      </CardBody>
    </Card>
  );
}

// Frontend Settings Tab
function FrontendSettings({ settings, updateSetting }) {
  return (
    <Card>
      <CardBody>
        <TextControl
          label={__('Success Message', 'subtleforms')}
          value={settings.success_message}
          onChange={(value) => updateSetting('success_message', value)}
          help={__('Message shown after successful submission', 'subtleforms')}
        />

        <TextControl
          label={__('Error Message', 'subtleforms')}
          value={settings.error_message}
          onChange={(value) => updateSetting('error_message', value)}
          help={__(
            'Generic error message shown on submission failure',
            'subtleforms'
          )}
        />

        <TextControl
          label={__('Redirect After Submit (URL)', 'subtleforms')}
          value={settings.redirect_after_submit}
          onChange={(value) => updateSetting('redirect_after_submit', value)}
          help={__(
            'Optional URL to redirect after submission (leave empty to show message)',
            'subtleforms'
          )}
          placeholder='https://example.com/thank-you'
        />

        <ToggleControl
          label={__('Enable Submission Limit', 'subtleforms')}
          checked={settings.submission_limit_enabled}
          onChange={(value) => updateSetting('submission_limit_enabled', value)}
          help={__('Limit submissions per user/IP address', 'subtleforms')}
        />

        {settings.submission_limit_enabled && (
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
        )}
      </CardBody>
    </Card>
  );
}

// Email Settings Tab
function EmailSettings({ settings, updateSetting }) {
  return (
    <Card>
      <CardBody>
        <ToggleControl
          label={__('Admin Notifications', 'subtleforms')}
          checked={settings.admin_notification_enabled}
          onChange={(value) =>
            updateSetting('admin_notification_enabled', value)
          }
          help={__('Send email to admin on new submissions', 'subtleforms')}
        />

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

        <TextControl
          label={__('Sender Name', 'subtleforms')}
          value={settings.sender_name}
          onChange={(value) => updateSetting('sender_name', value)}
          help={__(
            'Email sender name (leave empty for site name)',
            'subtleforms'
          )}
          placeholder={
            window.subtleformsData?.siteName || __('Your Site', 'subtleforms')
          }
        />

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
      </CardBody>
    </Card>
  );
}

// Advanced Settings Tab
function AdvancedSettings({ settings, updateSetting, resetSettings, saving }) {
  return (
    <Card>
      <CardBody>
        <ToggleControl
          label={__('Debug Mode', 'subtleforms')}
          checked={settings.debug_mode}
          onChange={(value) => updateSetting('debug_mode', value)}
          help={__(
            'Enable detailed logging for troubleshooting',
            'subtleforms'
          )}
        />

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
      </CardBody>
    </Card>
  );
}

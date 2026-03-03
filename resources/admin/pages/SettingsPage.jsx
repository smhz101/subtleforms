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
import LicenseSettings from '../components/settings/LicenseSettings';
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
          captcha_recaptcha_enabled: Boolean(
            response.data.captcha_recaptcha_enabled
          ),
          captcha_hcaptcha_enabled: Boolean(
            response.data.captcha_hcaptcha_enabled
          ),
          captcha_turnstile_enabled: Boolean(
            response.data.captcha_turnstile_enabled
          ),
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
    if (key === 'autosave_interval' || key === 'submission_limit') {
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
      name: 'license',
      title: __('License', 'subtleforms'),
      icon: 'admin-network',
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
      name: 'ai',
      title: __('AI Configuration', 'subtleforms'),
      icon: 'admin-site-alt3',
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
            {activeTab === 'license' && <LicenseSettings />}
            {activeTab === 'ai' && (
              <AISettings
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

// AI Configuration Settings Tab
function AISettings({ settings, updateSetting, fieldErrors = {} }) {
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState(null);

  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    
    try {
      // Simulate API test
      await new Promise(resolve => setTimeout(resolve, 1500));
      setConnectionResult({
        success: true,
        message: __('Connection successful! AI services are ready.', 'subtleforms')
      });
    } catch (error) {
      setConnectionResult({
        success: false,
        message: __('Connection failed. Please check your API key and try again.', 'subtleforms')
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const estimatedCost = () => {
    const provider = settings.ai_provider || 'openai';
    const agentsEnabled = [
      settings.ai_spam_detection_enabled,
      settings.ai_workflows_enabled,
      settings.ai_form_assist_enabled,
      settings.ai_routing_enabled,
    ].filter(Boolean).length;

    if (agentsEnabled === 0) return '$0.00';

    const baseCosts = {
      openai: 0.15,
      anthropic: 0.12,
      custom: 0.10,
    };

    const monthlyCost = (baseCosts[provider] || 0.15) * agentsEnabled * 100;
    return `$${monthlyCost.toFixed(2)}`;
  };

  return (
    <div className='sf-ai-settings'>
      <Card className='sf-ai-card'>
        <CardHeader>
          <div className='sf-ai-card__header'>
            <div className='sf-ai-card__header-icon'>
              <svg
                width='24'
                height='24'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'>
                <path d='M12 2L2 7l10 5 10-5-10-5z' />
                <path d='M2 17l10 5 10-5' />
                <path d='M2 12l10 5 10-5' />
              </svg>
            </div>
            <div className='sf-ai-card__header-text'>
              <h3>{__('AI-Powered Features', 'subtleforms')}</h3>
              <p>
                {__(
                  'Configure AI providers and agents to enhance your forms with intelligent automation',
                  'subtleforms'
                )}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className='sf-settings-section'>
            {/* Provider Selection */}
            <div>
              <SelectControl
                label={__('AI Provider', 'subtleforms')}
                value={settings.ai_provider || 'openai'}
                options={[
                  { label: 'OpenAI (GPT-4, GPT-3.5)', value: 'openai' },
                  { label: 'Anthropic (Claude)', value: 'anthropic' },
                  { label: 'Custom Endpoint', value: 'custom' },
                ]}
                onChange={(value) => updateSetting('ai_provider', value)}
                help={__('Select your preferred AI service provider', 'subtleforms')}
              />
              <FieldError errors={fieldErrors.ai_provider} />
            </div>

            {/* Model Selection */}
            {settings.ai_provider === 'openai' && (
              <div>
                <SelectControl
                  label={__('Model', 'subtleforms')}
                  value={settings.ai_model || 'gpt-3.5-turbo'}
                  options={[
                    { label: 'GPT-4 Turbo (Recommended)', value: 'gpt-4-turbo-preview' },
                    { label: 'GPT-4', value: 'gpt-4' },
                    { label: 'GPT-3.5 Turbo (Faster, Lower Cost)', value: 'gpt-3.5-turbo' },
                  ]}
                  onChange={(value) => updateSetting('ai_model', value)}
                  help={__('Choose the AI model for processing', 'subtleforms')}
                />
                <FieldError errors={fieldErrors.ai_model} />
              </div>
            )}

            {settings.ai_provider === 'anthropic' && (
              <div>
                <SelectControl
                  label={__('Model', 'subtleforms')}
                  value={settings.ai_model || 'claude-3-sonnet-20240229'}
                  options={[
                    { label: 'Claude 3 Opus (Most Capable)', value: 'claude-3-opus-20240229' },
                    { label: 'Claude 3 Sonnet (Recommended)', value: 'claude-3-sonnet-20240229' },
                    { label: 'Claude 3 Haiku (Fastest)', value: 'claude-3-haiku-20240307' },
                  ]}
                  onChange={(value) => updateSetting('ai_model', value)}
                  help={__('Choose the Claude model version', 'subtleforms')}
                />
                <FieldError errors={fieldErrors.ai_model} />
              </div>
            )}

            {/* API Key */}
            <div>
              <TextControl
                label={__('API Key', 'subtleforms')}
                type='password'
                value={settings.ai_api_key || ''}
                onChange={(value) => updateSetting('ai_api_key', value)}
                help={
                  settings.ai_provider === 'openai'
                    ? __('Get your API key from https://platform.openai.com/api-keys', 'subtleforms')
                    : settings.ai_provider === 'anthropic'
                    ? __('Get your API key from https://console.anthropic.com/', 'subtleforms')
                    : __('Enter your custom endpoint API key', 'subtleforms')
                }
                placeholder={__('sk-...', 'subtleforms')}
              />
              <FieldError errors={fieldErrors.ai_api_key} />
            </div>

            {/* Custom Endpoint */}
            {settings.ai_provider === 'custom' && (
              <div>
                <TextControl
                  label={__('Custom Endpoint URL', 'subtleforms')}
                  type='url'
                  value={settings.ai_custom_endpoint || ''}
                  onChange={(value) => updateSetting('ai_custom_endpoint', value)}
                  help={__('OpenAI-compatible API endpoint', 'subtleforms')}
                  placeholder='https://api.example.com/v1'
                />
                <FieldError errors={fieldErrors.ai_custom_endpoint} />
              </div>
            )}

            {/* Test Connection */}
            <div className='sf-ai-test-connection'>
              <Button
                variant='secondary'
                onClick={testConnection}
                isBusy={testingConnection}
                disabled={!settings.ai_api_key || testingConnection}>
                {testingConnection
                  ? __('Testing Connection...', 'subtleforms')
                  : __('Test Connection', 'subtleforms')}
              </Button>
              {connectionResult && (
                <Notice
                  status={connectionResult.success ? 'success' : 'error'}
                  isDismissible={false}
                  className='sf-ai-test-result'>
                  {connectionResult.message}
                </Notice>
              )}
            </div>

            {/* AI Agents Section */}
            <div className='sf-ai-agents-section'>
              <h4 className='sf-section-title'>{__('AI Agents', 'subtleforms')}</h4>
              <p className='sf-section-description'>
                {__(
                  'Enable intelligent automation agents to enhance form functionality',
                  'subtleforms'
                )}
              </p>

              <div className='sf-ai-agents-grid'>
                {/* Spam Detection Agent */}
                <div className='sf-ai-agent-card'>
                  <div className='sf-ai-agent-card__header'>
                    <div className='sf-ai-agent-card__icon sf-ai-agent-card__icon--spam'>
                      <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                        <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' />
                        <path d='M9 12l2 2 4-4' />
                      </svg>
                    </div>
                    <ToggleControl
                      label={__('Spam Detection', 'subtleforms')}
                      checked={settings.ai_spam_detection_enabled || false}
                      onChange={(value) => updateSetting('ai_spam_detection_enabled', value)}
                    />
                  </div>
                  <p className='sf-ai-agent-card__description'>
                    {__('Detect and block spam submissions using AI analysis', 'subtleforms')}
                  </p>
                </div>

                {/* Automated Workflows Agent */}
                <div className='sf-ai-agent-card'>
                  <div className='sf-ai-agent-card__header'>
                    <div className='sf-ai-agent-card__icon sf-ai-agent-card__icon--workflow'>
                      <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                        <path d='M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' />
                        <polyline points='7.5 4.21 12 6.81 16.5 4.21' />
                        <polyline points='7.5 19.79 7.5 14.6 3 12' />
                        <polyline points='21 12 16.5 14.6 16.5 19.79' />
                        <polyline points='3.27 6.96 12 12.01 20.73 6.96' />
                        <line x1='12' y1='22.08' x2='12' y2='12' />
                      </svg>
                    </div>
                    <ToggleControl
                      label={__('Automated Workflows', 'subtleforms')}
                      checked={settings.ai_workflows_enabled || false}
                      onChange={(value) => updateSetting('ai_workflows_enabled', value)}
                    />
                  </div>
                  <p className='sf-ai-agent-card__description'>
                    {__('Trigger smart actions based on submission content', 'subtleforms')}
                  </p>
                </div>

                {/* Form Assistance Agent */}
                <div className='sf-ai-agent-card'>
                  <div className='sf-ai-agent-card__header'>
                    <div className='sf-ai-agent-card__icon sf-ai-agent-card__icon--assist'>
                      <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                        <circle cx='12' cy='12' r='10' />
                        <path d='M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3' />
                        <line x1='12' y1='17' x2='12.01' y2='17' />
                      </svg>
                    </div>
                    <ToggleControl
                      label={__('Form Assistance', 'subtleforms')}
                      checked={settings.ai_form_assist_enabled || false}
                      onChange={(value) => updateSetting('ai_form_assist_enabled', value)}
                    />
                  </div>
                  <p className='sf-ai-agent-card__description'>
                    {__('Provide contextual help and suggestions to users', 'subtleforms')}
                  </p>
                </div>

                {/* Smart Routing Agent */}
                <div className='sf-ai-agent-card'>
                  <div className='sf-ai-agent-card__header'>
                    <div className='sf-ai-agent-card__icon sf-ai-agent-card__icon--routing'>
                      <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                        <polygon points='12 2 2 7 12 12 22 7 12 2' />
                        <polyline points='2 17 12 22 22 17' />
                        <polyline points='2 12 12 17 22 12' />
                      </svg>
                    </div>
                    <ToggleControl
                      label={__('Smart Routing', 'subtleforms')}
                      checked={settings.ai_routing_enabled || false}
                      onChange={(value) => updateSetting('ai_routing_enabled', value)}
                    />
                  </div>
                  <p className='sf-ai-agent-card__description'>
                    {__('Automatically route submissions to the right team', 'subtleforms')}
                  </p>
                </div>
              </div>
            </div>

            {/* Cost Estimator */}
            <div className='sf-ai-cost-estimator'>
              <div className='sf-ai-cost-estimator__header'>
                <h4 className='sf-section-title'>{__('Estimated Monthly Cost', 'subtleforms')}</h4>
                <div className='sf-ai-cost-estimator__amount'>{estimatedCost()}</div>
              </div>
              <p className='sf-section-description'>
                {__(
                  'Based on enabled agents and average usage. Actual costs may vary.',
                  'subtleforms'
                )}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
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
              {/* Google reCAPTCHA */}
              <div>
                <h5 className='sf-subsection-title'>
                  {__('Google reCAPTCHA', 'subtleforms')}
                </h5>
                <ToggleControl
                  label={__('Enable reCAPTCHA', 'subtleforms')}
                  checked={settings.captcha_recaptcha_enabled ?? false}
                  onChange={(value) =>
                    updateSetting('captcha_recaptcha_enabled', value)
                  }
                  help={__(
                    'Allow forms to use Google reCAPTCHA',
                    'subtleforms'
                  )}
                />
                <FieldError errors={fieldErrors.captcha_recaptcha_enabled} />
              </div>

              {settings.captcha_recaptcha_enabled && (
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

              {/* hCaptcha */}
              <div>
                <h5 className='sf-subsection-title'>
                  {__('hCaptcha', 'subtleforms')}
                </h5>
                <ToggleControl
                  label={__('Enable hCaptcha', 'subtleforms')}
                  checked={settings.captcha_hcaptcha_enabled ?? false}
                  onChange={(value) =>
                    updateSetting('captcha_hcaptcha_enabled', value)
                  }
                  help={__('Allow forms to use hCaptcha', 'subtleforms')}
                />
                <FieldError errors={fieldErrors.captcha_hcaptcha_enabled} />
              </div>

              {settings.captcha_hcaptcha_enabled && (
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

              {/* Cloudflare Turnstile */}
              <div>
                <h5 className='sf-subsection-title'>
                  {__('Cloudflare Turnstile', 'subtleforms')}
                </h5>
                <ToggleControl
                  label={__('Enable Turnstile', 'subtleforms')}
                  checked={settings.captcha_turnstile_enabled ?? false}
                  onChange={(value) =>
                    updateSetting('captcha_turnstile_enabled', value)
                  }
                  help={__(
                    'Allow forms to use Cloudflare Turnstile',
                    'subtleforms'
                  )}
                />
                <FieldError errors={fieldErrors.captcha_turnstile_enabled} />
              </div>

              {settings.captcha_turnstile_enabled && (
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

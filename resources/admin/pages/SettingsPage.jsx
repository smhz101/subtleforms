import { Button, Notice, Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import useSettingsState from '../hooks/useSettingsState';
import AdminShell from '../components/AdminShell';
import GeneralSettings from '../components/settings/GeneralSettings';
import FrontendSettings from '../components/settings/FrontendSettings';
import EmailSettings from '../components/settings/EmailSettings';
import AISettings from '../components/settings/AISettings';
import AdvancedSettings from '../components/settings/AdvancedSettings';
import LicenseSettings from '../components/settings/LicenseSettings';
import './SettingsPage.scss';

/**
 * Tab definitions for the settings sidebar.
 */
const TABS = [
  { name: 'general', title: __('General', 'subtleforms'), icon: 'admin-settings' },
  { name: 'license', title: __('License', 'subtleforms'), icon: 'admin-network' },
  { name: 'frontend', title: __('Frontend', 'subtleforms'), icon: 'admin-appearance' },
  { name: 'email', title: __('Email / Notifications', 'subtleforms'), icon: 'email' },
  { name: 'ai', title: __('AI Configuration', 'subtleforms'), icon: 'admin-site-alt3' },
  { name: 'advanced', title: __('Advanced', 'subtleforms'), icon: 'admin-tools' },
];

/**
 * Settings Page — composition-only shell.
 *
 * All state management lives in useSettingsState.
 * Tab panels are imported from components/settings/*.
 */
export default function Settings() {
  const {
    settings,
    loading,
    saving,
    message,
    setMessage,
    fieldErrors,
    hasChanges,
    activeTab,
    setActiveTab,
    updateSetting,
    saveSettings,
    loadSettings,
    resetSettings,
  } = useSettingsState();

  // ── Loading state ────────────────────────────────────────────────────
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

  // ── Error / empty state ──────────────────────────────────────────────
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

  // ── Action buttons ───────────────────────────────────────────────────
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

  // ── Render ───────────────────────────────────────────────────────────
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
              {TABS.map((tab) => (
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


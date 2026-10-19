import { Button, Notice } from '@wordpress/components';
import { useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import useSettingsState from '../hooks/useSettingsState';
import AdminShell from '../components/AdminShell';
import GeneralSettings from '../components/settings/GeneralSettings';
import FrontendSettings from '../components/settings/FrontendSettings';
import EmailSettings from '../components/settings/EmailSettings';
import AdvancedSettings from '../components/settings/AdvancedSettings';
import LicenseSettings from '../components/settings/LicenseSettings';
import ExtensionsSettings from '../components/settings/ExtensionsSettings';
import BrandingSettings from '../components/settings/BrandingSettings';
import { getBranding } from '../utils/branding';
import { isProFeature } from '../utils/featureGate';
import Icon from '../ui/Icon';
import { getPlanState } from '../data/proCatalog';
import './SettingsPage.scss';

/**
 * Settings sections, grouped like core's Site Settings: what the plugin does
 * day to day, then Pro.
 */
const GROUPS = [
  {
    key: 'site',
    title: __('Forms', 'subtleforms'),
    tabs: [
      {
        name: 'general',
        icon: Icon.Settings,
        title: __('General', 'subtleforms'),
        description: __('Defaults for new forms, autosave and deleting.', 'subtleforms'),
      },
      {
        name: 'frontend',
        icon: Icon.Monitor,
        title: __('Display', 'subtleforms'),
        description: __('Messages and behaviour visitors see on your site.', 'subtleforms'),
      },
      {
        name: 'email',
        icon: Icon.Mail,
        title: __('Email', 'subtleforms'),
        description: __('Who gets notified, what they receive and who it comes from.', 'subtleforms'),
      },
      {
        name: 'advanced',
        icon: Icon.Shield,
        title: __('Security & privacy', 'subtleforms'),
        description: __('Spam protection, CAPTCHA, data retention and debugging.', 'subtleforms'),
      },
      {
        name: 'extensions',
        icon: Icon.Puzzle,
        title: __('Integrations', 'subtleforms'),
        description: __('Webhook defaults, form analytics and the integrations your add-ons bring.', 'subtleforms'),
      },
    ],
  },
  {
    key: 'pro',
    title: __('Pro', 'subtleforms'),
    tabs: [
      {
        name: 'license',
        icon: Icon.KeyRound,
        title: __('License', 'subtleforms'),
        description: __('Your plan, license key and what it unlocks.', 'subtleforms'),
      },
      {
        name: 'branding',
        icon: Icon.Palette,
        title: __('Branding', 'subtleforms'),
        description: __('Your name and logo in the forms admin, and which SubtleForms links appear.', 'subtleforms'),
        pro: true,
        // Restricted with the License screen when white label limits it to one admin.
        ownerOnly: true,
      },
    ],
  },
];

// White label can limit the License and Branding screens to one admin.
const VISIBLE_GROUPS = getBranding().showLicense
  ? GROUPS
  : GROUPS.map((g) => ({
      ...g,
      tabs: g.tabs.filter((t) => t.name !== 'license' && !t.ownerOnly),
    }));

const ALL_TABS = VISIBLE_GROUPS.flatMap((g) => g.tabs);

// Tabs with nothing to save (they manage their own state).
const READ_ONLY_TABS = ['license', 'branding'];

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

  const { licensed } = getPlanState();
  const current = ALL_TABS.find((t) => t.name === activeTab) || ALL_TABS[0];

  // Keep the tab in the hash so reloads and links land in the same place.
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    if (params.get('tab') !== current.name) {
      params.set('tab', current.name);
      if (current.name !== 'extensions') params.delete('ext');
      window.history.replaceState(null, '', `#${params.toString()}`);
    }
  }, [current.name]);

  // Ctrl/Cmd+S saves.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges && !saving) saveSettings();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasChanges, saving, saveSettings]);

  if (loading) {
    return (
      <AdminShell
        title={__('Settings', 'subtleforms')}
        isLoading
        loadingLabel={__('Loading settings…', 'subtleforms')}
      />
    );
  }

  if (!settings) {
    return (
      <AdminShell
        title={__('Settings', 'subtleforms')}
        error={__('Settings could not be loaded.', 'subtleforms')}
        onRetry={loadSettings}
      />
    );
  }

  const canSave = !READ_ONLY_TABS.includes(current.name);

  return (
    <AdminShell
      title={__('Settings', 'subtleforms')}
      description={__('Site-wide defaults. Each form can override most of these in its own settings.', 'subtleforms')}
      actions={
        canSave ? (
          <Button
            variant='primary'
            onClick={saveSettings}
            isBusy={saving}
            disabled={saving || !hasChanges}
            accessibleWhenDisabled>
            {saving ? __('Saving…', 'subtleforms') : __('Save', 'subtleforms')}
          </Button>
        ) : null
      }>
      <div className='sf-settings'>
        <nav className='sf-settings__nav' aria-label={__('Settings sections', 'subtleforms')}>
          {VISIBLE_GROUPS.map((group) => (
            <div key={group.key} className='sf-settings__nav-group'>
              <p className='sf-settings__nav-heading'>{group.title}</p>
              <ul>
                {group.tabs.map((tab) => {
                  const TabIcon = tab.icon;
                  const isActive = current.name === tab.name;
                  return (
                    <li key={tab.name}>
                      <button
                        type='button'
                        className={`sf-settings__nav-item ${isActive ? 'is-active' : ''}`}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => setActiveTab(tab.name)}>
                        <TabIcon size={18} aria-hidden='true' />
                        <span>{tab.title}</span>
                        {tab.name === 'branding' && !isProFeature('branding.white_label') ? (
                          <span className='sf-settings__nav-pro'>{__('Agency', 'subtleforms')}</span>
                        ) : (
                          tab.pro && !licensed && (
                            <span className='sf-settings__nav-pro'>{__('Pro', 'subtleforms')}</span>
                          )
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className='sf-settings__content'>
          <header className='sf-settings__header'>
            <h2 className='sf-settings__title'>{current.title}</h2>
            <p className='sf-settings__description'>{current.description}</p>
          </header>

          {message && (
            <Notice
              status={message.type}
              isDismissible
              onRemove={() => setMessage(null)}
              className='sf-settings__notice'>
              {message.text}
            </Notice>
          )}

          <div className={`sf-settings__panel sf-settings__panel--${current.name}`}>
            {current.name === 'general' && (
              <GeneralSettings settings={settings} updateSetting={updateSetting} fieldErrors={fieldErrors} />
            )}
            {current.name === 'frontend' && (
              <FrontendSettings settings={settings} updateSetting={updateSetting} fieldErrors={fieldErrors} />
            )}
            {current.name === 'email' && (
              <EmailSettings settings={settings} updateSetting={updateSetting} fieldErrors={fieldErrors} />
            )}
            {current.name === 'license' && <LicenseSettings />}
            {current.name === 'branding' && <BrandingSettings />}
            {current.name === 'advanced' && (
              <AdvancedSettings
                settings={settings}
                updateSetting={updateSetting}
                resetSettings={resetSettings}
                saving={saving}
                fieldErrors={fieldErrors}
              />
            )}
            {current.name === 'extensions' && (
              <ExtensionsSettings settings={settings} updateSetting={updateSetting} fieldErrors={fieldErrors} />
            )}
          </div>
        </div>
      </div>

      {canSave && hasChanges && (
        <div className='sf-savebar' role='region' aria-label={__('Unsaved changes', 'subtleforms')}>
          <span className='sf-savebar__text'>
            <span className='sf-savebar__dot' aria-hidden='true' />
            {__('You have unsaved changes', 'subtleforms')}
          </span>
          <div className='sf-savebar__actions'>
            <Button variant='tertiary' onClick={loadSettings} disabled={saving}>
              {__('Discard', 'subtleforms')}
            </Button>
            <Button variant='primary' onClick={saveSettings} isBusy={saving} disabled={saving}>
              {__('Save changes', 'subtleforms')}
            </Button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

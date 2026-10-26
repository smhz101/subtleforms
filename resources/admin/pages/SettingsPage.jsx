import { Button, Notice } from '@wordpress/components';
import { Suspense, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import useSettingsState from '../hooks/useSettingsState';
import AdminShell from '../components/AdminShell';
import GeneralSettings from '../components/settings/GeneralSettings';
import FrontendSettings from '../components/settings/FrontendSettings';
import EmailSettings from '../components/settings/EmailSettings';
import AdvancedSettings from '../components/settings/AdvancedSettings';
import ExtensionsSettings from '../components/settings/ExtensionsSettings';
import lazyWithRetry from '../utils/lazyWithRetry';
import { settingsTabs, getSettingsTab } from '../../shared/extend';
import Icon from '../ui/Icon';
import './SettingsPage.scss';

const ToolsPanel = lazyWithRetry(() => import(/* webpackChunkName: "page-tools" */ './ToolsPage'));

/**
 * Settings sections, grouped like core's Site Settings: what the plugin does
 * day to day (ending with Tools), then the tabs add-ons register.
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
        description: __('Webhook defaults and the integrations your add-ons bring.', 'subtleforms'),
      },
      {
        name: 'tools',
        icon: Icon.Wrench,
        title: __('Tools', 'subtleforms'),
        description: __('Move forms and entries, bring a form across from another plugin, and read what the site has been doing.', 'subtleforms'),
      },
    ],
  },
  {
    key: 'addons',
    title: __('Add-ons', 'subtleforms'),
    tabs: [],
  },
];

// A group with no tab (no add-on tab registered) is not shown.
const withTabs = (groups) => groups.filter((g) => g.tabs.length > 0);

export const ALL_TABS = GROUPS.flatMap((g) => g.tabs);

const BUILT_IN = ALL_TABS.map((t) => t.name);

/**
 * The groups with the tabs add-ons registered (SubtleFormsExtend.registerSettingsTab).
 * A tab with `group: 'site'` goes after Tools; any other tab with a title
 * joins the Add-ons group.
 *
 * @return {Array} Groups.
 */
export function getGroups() {
  const added = settingsTabs()
    .filter((t) => !BUILT_IN.includes(t.name) && t.title)
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
    .map((t) => ({
      name: t.name,
      icon: t.icon && (typeof t.icon === 'function' || typeof t.icon === 'object') ? t.icon : Icon.Puzzle,
      title: t.title,
      description: t.description || '',
      group: t.group === 'site' ? 'site' : 'addons',
    }));
  if (!added.length) return withTabs(GROUPS);
  return withTabs(GROUPS.map((g) => ({
    ...g,
    tabs: [...g.tabs, ...added.filter((t) => t.group === g.key).map(({ group, ...tab }) => tab)], // eslint-disable-line no-unused-vars
  })));
}

/**
 * The tab to show for a name from the URL. A name that no longer exists, for
 * example a bookmarked tab=branding, falls back to the first tab.
 */
export function resolveTab(name, tabs = getGroups().flatMap((g) => g.tabs)) {
  return tabs.find((t) => t.name === name) || tabs[0];
}

// Tabs with nothing to save (they manage their own state).
// Tabs from add-ons look after their own data too.
const READ_ONLY_TABS = ['tools'];
const isReadOnly = (name) => READ_ONLY_TABS.includes(name) || !BUILT_IN.includes(name);

/** Body of a tab an add-on registered. */
function AddonTab({ name }) {
  const Body = getSettingsTab(name)?.component;
  return Body ? <Body /> : null;
}

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

  const groups = getGroups();
  const current = resolveTab(activeTab, groups.flatMap((g) => g.tabs));

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

  const canSave = !isReadOnly(current.name);

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
          {groups.map((group) => (
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
            {current.name === 'tools' && (
              <Suspense fallback={<p role='status'>{__('Loading…', 'subtleforms')}</p>}>
                <ToolsPanel embedded />
              </Suspense>
            )}
            {!BUILT_IN.includes(current.name) && <AddonTab name={current.name} />}
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

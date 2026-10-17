import { ToggleControl, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import FieldError from '../FieldError';

/**
 * Analytics Extension Settings Panel
 */
export default function AnalyticsPanel({ settings, updateSetting, fieldErrors = {} }) {
  return (
    <div className='sf-ext-panel'>
      <div className='sf-ext-panel__header'>
        <h2 className='sf-ext-panel__title'>{__('Analytics', 'subtleforms')}</h2>
        <p className='sf-ext-panel__description'>
          {__(
            'See how many people view each form, how many submit it, and the conversion rate. Results appear on the Forms list and the Dashboard.',
            'subtleforms'
          )}
        </p>
      </div>

      <div className='sf-ext-panel__body'>
        <div className='sf-settings-field'>
          <ToggleControl
            label={__('Enable Analytics', 'subtleforms')}
            checked={!!settings.ext_analytics_enabled}
            onChange={(v) => updateSetting('ext_analytics_enabled', v)}
            help={__('Counts views and submissions per form, per day.', 'subtleforms')}
          />
          <FieldError errors={fieldErrors.ext_analytics_enabled} />
        </div>

        {settings.ext_analytics_enabled && (
          <>
            <div className='sf-settings-field'>
              <ToggleControl
                label={__('Count form views', 'subtleforms')}
                checked={!!settings.ext_analytics_view_tracking}
                onChange={(v) => updateSetting('ext_analytics_view_tracking', v)}
                help={__(
                  'A view is counted once per page load, when the form scrolls into sight. Turn this off to count submissions only.',
                  'subtleforms'
                )}
              />
              <FieldError errors={fieldErrors.ext_analytics_view_tracking} />
            </div>

            <div className='sf-settings-field'>
              <TextControl
                label={__('Keep daily totals for (days)', 'subtleforms')}
                type='number'
                value={String(settings.ext_analytics_retention_days ?? 90)}
                onChange={(v) => updateSetting('ext_analytics_retention_days', Number(v))}
                min='1'
                max='3650'
                help={__('Older daily totals are deleted once a day. Between 1 and 3650 days.', 'subtleforms')}
              />
              <FieldError errors={fieldErrors.ext_analytics_retention_days} />
            </div>
          </>
        )}

        <div className='sf-ext-panel__info'>
          <p className='sf-ext-panel__info-text'>
            {__(
              'Privacy: no cookies are set and no IP address, user agent or other personal data is stored. Each view only adds one to a daily total for the form, kept in your WordPress database.',
              'subtleforms'
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

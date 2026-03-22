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
            'Track form views and submission counts natively. Stats are stored in WordPress without any third-party service.',
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
            help={__('Track submission counts and exposure rates for each form.', 'subtleforms')}
          />
          <FieldError errors={fieldErrors.ext_analytics_enabled} />
        </div>

        {settings.ext_analytics_enabled && (
          <>
            <div className='sf-settings-field'>
              <ToggleControl
                label={__('View Tracking', 'subtleforms')}
                checked={!!settings.ext_analytics_view_tracking}
                onChange={(v) => updateSetting('ext_analytics_view_tracking', v)}
                help={__(
                  'Count each time a form is rendered on the front end (fires the subtleforms/form/viewed hook).',
                  'subtleforms'
                )}
              />
              <FieldError errors={fieldErrors.ext_analytics_view_tracking} />
            </div>

            <div className='sf-settings-field'>
              <TextControl
                label={__('Data Retention (days)', 'subtleforms')}
                type='number'
                value={String(settings.ext_analytics_retention_days ?? 90)}
                onChange={(v) => updateSetting('ext_analytics_retention_days', Number(v))}
                min='1'
                max='3650'
                help={__(
                  'How long to keep per-form analytics data (1–3650 days).',
                  'subtleforms'
                )}
              />
              <FieldError errors={fieldErrors.ext_analytics_retention_days} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

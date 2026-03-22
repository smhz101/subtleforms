import { ToggleControl, SelectControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import FieldError from '../FieldError';

const PROVIDERS = [
  { label: 'WPML', value: 'wpml' },
  { label: 'Polylang', value: 'polylang' },
];

/**
 * Multilanguage Extension Settings Panel
 */
export default function MultilanguagePanel({ settings, updateSetting, fieldErrors = {} }) {
  return (
    <div className='sf-ext-panel'>
      <div className='sf-ext-panel__header'>
        <h2 className='sf-ext-panel__title'>{__('Multilanguage', 'subtleforms')}</h2>
        <p className='sf-ext-panel__description'>
          {__(
            'Register form strings with WPML or Polylang so they can be translated via those plugins\' translation interfaces.',
            'subtleforms'
          )}
        </p>
      </div>

      <div className='sf-ext-panel__body'>
        <div className='sf-settings-field'>
          <ToggleControl
            label={__('Enable Multilanguage', 'subtleforms')}
            checked={!!settings.ext_multilanguage_enabled}
            onChange={(v) => updateSetting('ext_multilanguage_enabled', v)}
            help={__(
              'Register SubtleForms strings with your translation plugin.',
              'subtleforms'
            )}
          />
          <FieldError errors={fieldErrors.ext_multilanguage_enabled} />
        </div>

        {settings.ext_multilanguage_enabled && (
          <div className='sf-settings-field'>
            <SelectControl
              label={__('Translation Plugin', 'subtleforms')}
              value={settings.ext_multilanguage_provider || 'wpml'}
              options={PROVIDERS}
              onChange={(v) => updateSetting('ext_multilanguage_provider', v)}
              help={__('Which translation plugin to register strings with.', 'subtleforms')}
            />
            <FieldError errors={fieldErrors.ext_multilanguage_provider} />
          </div>
        )}

        {settings.ext_multilanguage_enabled && (
          <div className='sf-ext-panel__info'>
            <p className='sf-ext-panel__info-text'>
              {__(
                'Once enabled, form titles, labels, and descriptions will appear in the Translation Editor of your chosen multilanguage plugin.',
                'subtleforms'
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

import { ToggleControl, SelectControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import FieldError from '../FieldError';

const TEMPLATES = [
  { label: __('Default', 'subtleforms'), value: 'default' },
  { label: __('Minimal', 'subtleforms'), value: 'minimal' },
  { label: __('Detailed', 'subtleforms'), value: 'detailed' },
];

/**
 * PDF Extension Settings Panel
 */
export default function PdfPanel({ settings, updateSetting, fieldErrors = {} }) {
  return (
    <div className='sf-ext-panel'>
      <div className='sf-ext-panel__header'>
        <h2 className='sf-ext-panel__title'>{__('PDF Generator', 'subtleforms')}</h2>
        <p className='sf-ext-panel__description'>
          {__(
            'Generate a PDF document from each form submission and optionally attach it to the notification email.',
            'subtleforms'
          )}
        </p>
      </div>

      <div className='sf-ext-panel__body'>
        <div className='sf-settings-field'>
          <ToggleControl
            label={__('Enable PDF Generator', 'subtleforms')}
            checked={!!settings.ext_pdf_enabled}
            onChange={(v) => updateSetting('ext_pdf_enabled', v)}
            help={__('Generate a PDF for every new form submission.', 'subtleforms')}
          />
          <FieldError errors={fieldErrors.ext_pdf_enabled} />
        </div>

        {settings.ext_pdf_enabled && (
          <>
            <div className='sf-settings-field'>
              <SelectControl
                label={__('PDF Template', 'subtleforms')}
                value={settings.ext_pdf_template || 'default'}
                options={TEMPLATES}
                onChange={(v) => updateSetting('ext_pdf_template', v)}
                help={__('Layout used when rendering the PDF document.', 'subtleforms')}
              />
              <FieldError errors={fieldErrors.ext_pdf_template} />
            </div>

            <div className='sf-settings-field'>
              <ToggleControl
                label={__('Attach to Notification Email', 'subtleforms')}
                checked={!!settings.ext_pdf_attach_to_email}
                onChange={(v) => updateSetting('ext_pdf_attach_to_email', v)}
                help={__(
                  'Attach the generated PDF to the admin notification email for each submission.',
                  'subtleforms'
                )}
              />
              <FieldError errors={fieldErrors.ext_pdf_attach_to_email} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

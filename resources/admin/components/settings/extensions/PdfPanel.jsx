import { ToggleControl, SelectControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import FieldError from '../FieldError';

const TEMPLATES = [
  { label: __('Default: logo, title band and answers', 'subtleforms'), value: 'default' },
  { label: __('Minimal: plain header, answers only', 'subtleforms'), value: 'minimal' },
  { label: __('Detailed: adds entry details and consent records', 'subtleforms'), value: 'detailed' },
];

/**
 * PDF Extension Settings Panel
 */
export default function PdfPanel({ settings, updateSetting, fieldErrors = {} }) {
  return (
    <div className='sf-ext-panel'>
      <div className='sf-ext-panel__header'>
        <h2 className='sf-ext-panel__title'>{__('Entry PDF', 'subtleforms')}</h2>
        <p className='sf-ext-panel__description'>
          {__(
            'A printable PDF of each entry with your site logo, the form title, the entry number and date, every answer and the order summary for payment forms. Download it from the entry screen or attach it to notification emails.',
            'subtleforms'
          )}
        </p>
      </div>

      <div className='sf-ext-panel__body'>
        <div className='sf-settings-field'>
          <SelectControl
            label={__('Layout', 'subtleforms')}
            value={settings.ext_pdf_template || 'default'}
            options={TEMPLATES}
            onChange={(v) => updateSetting('ext_pdf_template', v)}
            help={__('Used for downloads and email attachments. The logo comes from Appearance > Customize > Site Identity.', 'subtleforms')}
          />
          <FieldError errors={fieldErrors.ext_pdf_template} />
        </div>

        <div className='sf-settings-field'>
          <ToggleControl
            label={__('Attach the PDF to notification emails', 'subtleforms')}
            checked={!!settings.ext_pdf_enabled && !!settings.ext_pdf_attach_to_email}
            onChange={(v) => {
              updateSetting('ext_pdf_enabled', v);
              updateSetting('ext_pdf_attach_to_email', v);
            }}
            help={__(
              'Adds the entry PDF to emails sent to you and your team. Emails sent to the person who filled in the form (a recipient like {{email}}) are left as they are. The PDF is created after the visitor\'s submission, so it never slows the form down.',
              'subtleforms'
            )}
          />
          <FieldError errors={fieldErrors.ext_pdf_attach_to_email} />
        </div>
      </div>
    </div>
  );
}

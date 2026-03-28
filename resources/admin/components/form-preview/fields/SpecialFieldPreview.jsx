import { __ } from '@wordpress/i18n';
import { getFieldIcon } from '../../../utils/iconRegistry';

/**
 * SpecialFieldPreview Component
 *
 * Renders special fields: captcha, country, payment
 */
export default function SpecialFieldPreview({ field, fieldId }) {
  const config = field.config || {};
  const placeholder = config.placeholder || '';
  const helpText = config.help || '';
  const helpTextId = helpText ? `${fieldId}-help` : undefined;

  // CAPTCHA field
  if (field.type === 'captcha') {
    return (
      <div className='sf-captcha-preview sf-captcha-preview--preview-mode' role='img' aria-label={__('CAPTCHA preview placeholder', 'subtleforms')}>
        <div className='sf-captcha-preview__icon' aria-hidden='true'>🔒</div>
        <div className='sf-captcha-preview__content'>
          <div className='sf-captcha-preview__title'>
            {__('CAPTCHA Verification', 'subtleforms')}
          </div>
          <div className='sf-captcha-preview__description'>
            {__('CAPTCHA will appear here on the live form', 'subtleforms')}
          </div>
          {config.providerName && (
            <div className='sf-captcha-preview__provider'>
              {config.providerName === 'recaptcha' && 'Google reCAPTCHA'}
              {config.providerName === 'hcaptcha' && 'hCaptcha'}
              {config.providerName === 'turnstile' && 'Cloudflare Turnstile'}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Country selector
  if (field.type === 'country') {
    return (
      <>
        <select
          id={fieldId}
          className='sf-form-preview-field__input sf-country-field__select'
          aria-describedby={helpTextId}
          disabled>
          <option>{placeholder || __('Select a country', 'subtleforms')}</option>
          <option>🇺🇸 United States</option>
          <option>🇬🇧 United Kingdom</option>
          <option>🇨🇦 Canada</option>
          <option>🇦🇺 Australia</option>
          <option>🇩🇪 Germany</option>
          <option>🇫🇷 France</option>
          <option>🇪🇸 Spain</option>
          <option>🇮🇹 Italy</option>
          <option>🇯🇵 Japan</option>
          <option>🇨🇳 China</option>
          <option>{__('...and 235+ more countries', 'subtleforms')}</option>
        </select>
        <div className='sf-country-field__info' style={{ marginTop: '0.5rem' }}>
          {(() => { const CountryIcon = getFieldIcon('country'); return <CountryIcon size={16} aria-hidden='true' />; })()}
          <span style={{ fontSize: '0.75rem', fontStyle: 'italic', color: '#0369a1' }}>
            {__('Full ISO-3166 country list available on frontend', 'subtleforms')}
          </span>
        </div>
      </>
    );
  }

  // Hidden field (no render)
  if (field.type === 'hidden') {
    return null;
  }

  return null;
}

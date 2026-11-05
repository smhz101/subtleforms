import { useEffect, useState } from '@wordpress/element';
import { Button, FormToggle, Spinner } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import Icon from '../../../ui/Icon';
import ExtensionSlot from '../../ExtensionSlot';
import ProBanner from './ProBanner';
import { emailMarketingApi, announceService } from './api';
import './emailMarketing.scss';

/**
 * One service's screen, drawn in place of the grid: a header (back arrow,
 * logo, name, switch), the service's settings, whatever an add-on draws in
 * the `email_marketing.service.settings` slot, and the note about Pro.
 *
 * Switching the header toggle off keeps the key and settings and goes back to
 * the grid.
 *
 * @param {Object}   props
 * @param {Object}   props.service  Registered service ({ slug, label, icon, brandColor, settingsComponent }).
 * @param {Function} props.onBack   Return to the grid.
 * @param {Function} props.onToggle Called with (slug, enabled) after the switch changed on the server.
 * @param {boolean}  props.enabled  The switch, as the grid last knew it.
 */
export default function ServiceDetail({ service, onBack, onToggle, enabled }) {
  const [connection, setConnection] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const Logo = service.icon;
  const Settings = service.settingsComponent;
  const toggleId = `sf-em-toggle-${service.slug}`;

  useEffect(() => {
    let cancelled = false;
    emailMarketingApi
      .state(service.slug)
      .then((s) => !cancelled && setConnection(s))
      .catch((e) => !cancelled && setLoadError(e?.message || __('Could not load the connection.', 'subtleforms')));
    return () => {
      cancelled = true;
    };
  }, [service.slug]);

  const toggle = async (next) => {
    setBusy(true);
    setError('');
    try {
      await emailMarketingApi.setEnabled(service.slug, next);
      announceService(service.slug, { enabled: next });
      onToggle(service.slug, next);
      if (!next) onBack();
    } catch (e) {
      setError(e?.message || __('Could not change the switch.', 'subtleforms'));
    }
    setBusy(false);
  };

  const connected = !!connection && connection.has_key === true && connection.status !== 'error';

  return (
    <div className='sf-em-detail' data-service={service.slug}>
      <header className='sf-em-detail__head'>
        <Button
          className='sf-em-detail__back'
          icon={<Icon.ArrowLeft size={16} aria-hidden='true' />}
          label={__('Back to email marketing', 'subtleforms')}
          onClick={onBack}
        />
        <span className='sf-em-detail__logo' style={service.brandColor ? { color: service.brandColor } : undefined}>
          {Logo ? <Logo size={20} /> : null}
        </span>
        <h3 className='sf-em-detail__title'>{service.label}</h3>
        <span className='sf-em-detail__switch'>
          <label htmlFor={toggleId} className='sf-em-detail__switch-label'>
            {enabled ? __('Enabled', 'subtleforms') : __('Disabled', 'subtleforms')}
          </label>
          <FormToggle
            id={toggleId}
            checked={!!enabled}
            disabled={busy}
            onChange={(e) => toggle(e.target.checked)}
          />
        </span>
      </header>

      {error && (
        <p role='alert' className='sf-em-detail__error'>
          {error}
        </p>
      )}

      <div className='sf-em-detail__body'>
        {loadError && <p className='sf-em-card__error'>{loadError}</p>}
        {!loadError && !connection && (
          <p role='status' className='sf-em-card__loading'>
            <Spinner /> {__('Loading…', 'subtleforms')}
          </p>
        )}
        {connection && Settings && (
          <Settings service={service.slug} connection={connection} onConnection={setConnection} />
        )}
        {connection && (
          <ExtensionSlot name='email_marketing.service.settings' service={service.slug} connected={connected} />
        )}
      </div>
      <ProBanner />
    </div>
  );
}

/**
 * Hint text used by tests and the grid: the accessible name of a switch.
 *
 * @param {string} label Service name.
 * @return {string} "Enable Mailchimp".
 */
export function enableLabel(label) {
  return sprintf(
    /* translators: %s: service name */
    __('Enable %s', 'subtleforms'),
    label
  );
}

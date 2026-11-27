import { useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { Button, Spinner } from '@wordpress/components';
import { apiClient } from '../../data/apiClient';
import Icon from '../../ui/Icon';
import { getPlanLabels } from './catalog';
import './ExtensionCard.scss';

const POST_KINDS = ['install', 'activate', 'update'];

/**
 * One extension card, used on every tab. Only the action button acts.
 *
 * install, activate and update POST to /extensions/<kind> with the slug, then
 * call onChanged so the page refetches the catalog.
 */
export default function ExtensionCard({ entry, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [settingsUrl, setSettingsUrl] = useState('');
  const plans = getPlanLabels();
  const { action, status } = entry;

  const statusPill = {
    active: __('Active', 'subtleforms'),
    update: __('Update available', 'subtleforms'),
    installed: __('Installed', 'subtleforms'),
  }[status];

  let footerText = __('In your plan', 'subtleforms');
  if (status === 'included') {
    footerText = __('Included', 'subtleforms');
  } else if (status === 'locked') {
    /* translators: %s: plan name, for example Starter. */
    footerText = sprintf(__('%s plan', 'subtleforms'), plans[entry.plan] || entry.plan);
  }

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.post(`/extensions/${action.kind}`, { slug: entry.slug });
      if (action.kind !== 'update') {
        setSettingsUrl(res?.settingsUrl || entry.settingsUrl || '');
      }
      if (onChanged) {
        await onChanged();
      }
    } catch (err) {
      setError({
        message: err?.message || __('Something went wrong. Try again.', 'subtleforms'),
        downloadUrl: err?.status === 409 ? err?.data?.downloadUrl || err?.meta?.downloadUrl || '' : '',
      });
    } finally {
      setBusy(false);
    }
  };

  let button = null;
  if (action && POST_KINDS.includes(action.kind)) {
    button = (
      <Button variant='primary' size='compact' isBusy={busy} disabled={busy} onClick={run}>
        {busy ? <Spinner /> : null}
        {action.label}
      </Button>
    );
  } else if (action && action.kind === 'plans') {
    button = (
      <a className='sf-ext-card__link' href={action.url} target='_blank' rel='noopener noreferrer'>
        {action.label}
        <Icon.ExternalLink size={14} aria-hidden='true' />
        <span className='screen-reader-text'> {__('(opens in a new tab)', 'subtleforms')}</span>
      </a>
    );
  } else if (action) {
    button = (
      <a className='sf-ext-card__link' href={action.url}>
        {action.label}
      </a>
    );
  }

  return (
    <article className='sf-ext-card' data-status={status} data-slug={entry.slug}>
      <header className='sf-ext-card__top'>
        <span className='sf-ext-card__tile' aria-hidden='true'>
          <span className={`dashicons dashicons-${entry.icon}`} />
        </span>
        <div>
          <h3 className='sf-ext-card__title'>{entry.title}</h3>
          <p className='sf-ext-card__by'>{__('By SubtleForms', 'subtleforms')}</p>
        </div>
      </header>
      <p className='sf-ext-card__desc'>{entry.description}</p>
      {statusPill ? (
        <div className='sf-ext-card__badges'>
          <span className='sf-badge' data-type={status === 'active' ? 'success' : 'warning'}>
            {statusPill}
          </span>
        </div>
      ) : null}
      <footer className='sf-ext-card__footer'>
        <span className='sf-ext-card__plan'>{footerText}</span>
        {button}
      </footer>
      {settingsUrl && !error ? (
        <p className='sf-ext-card__note'>
          <a href={settingsUrl}>{__('Open settings', 'subtleforms')}</a>
        </p>
      ) : null}
      {error ? (
        <p className='sf-ext-card__error' role='alert'>
          {error.message}
          {error.downloadUrl ? (
            <>
              {' '}
              <a href={error.downloadUrl}>{__('Download the zip', 'subtleforms')}</a>
            </>
          ) : null}
        </p>
      ) : null}
    </article>
  );
}

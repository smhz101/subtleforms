import { useCallback, useEffect, useMemo, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import SectionHeader from '../../sectionPanel/SectionHeader';
import ProBanner from './ProBanner';
import ServiceDetail from './ServiceDetail';
import ServiceGrid from './ServiceGrid';
import { announceService, pageData } from './api';
import { useSetServiceEnabled } from './queries';
import { getEmailMarketingServices } from '../../../../shared/extend';
import './registerBuiltins';
import './emailMarketing.scss';

/**
 * The slug in the address (`#tab=extensions&ext=email_marketing&service=brevo`).
 *
 * @return {string} Slug, or '' for the grid.
 */
export function serviceFromHash() {
  const match = window.location.hash.match(/[#&]service=([\w-]+)/);
  return match ? match[1] : '';
}

/**
 * Put the service in the address. A new entry is added to the history, so the
 * browser's Back button returns to the grid; a refresh stays on the service.
 *
 * @param {string} slug Slug, or '' for the grid.
 */
export function writeServiceToHash(slug) {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  if (slug) {
    params.set('service', slug);
  } else {
    params.delete('service');
  }
  window.history.pushState(null, '', `#${params.toString()}`);
}

/**
 * Settings > Integrations > Email marketing: a grid of the services, and the
 * screen of one service in its place. Services come from the registry
 * (`registerEmailMarketingService`) and the server's list; a tile shows only
 * when both know the slug.
 */
export default function EmailMarketingSettings() {
  const [active, setActive] = useState(serviceFromHash);
  const [enabled, setEnabled] = useState(() => {
    const map = {};
    Object.entries(pageData().services).forEach(([slug, entry]) => {
      map[slug] = !!entry?.enabled;
    });
    return map;
  });
  const [busy, setBusy] = useState({});
  const [error, setError] = useState('');
  const setServiceEnabled = useSetServiceEnabled();

  const services = useMemo(() => {
    const server = pageData().services;
    return getEmailMarketingServices().filter((s) => server[s.slug] && server[s.slug].available !== false);
    // The registry can grow while the page loads; the list is read again on every address change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // The browser's Back and Forward buttons, and a hash edited by hand.
  useEffect(() => {
    const sync = () => setActive(serviceFromHash());
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);

  const open = useCallback((slug) => {
    writeServiceToHash(slug);
    setActive(slug);
  }, []);

  const setSwitch = useCallback((slug, value) => {
    setEnabled((current) => ({ ...current, [slug]: value }));
  }, []);

  // Off from the grid just switches the service off. On switches it on and
  // opens its screen, where the key goes.
  const toggleFromGrid = useCallback(
    async (slug, value) => {
      setError('');
      setBusy((current) => ({ ...current, [slug]: true }));
      setSwitch(slug, value);
      try {
        await setServiceEnabled.mutateAsync({ service: slug, enabled: value });
        announceService(slug, { enabled: value });
        if (value) open(slug);
      } catch (e) {
        setSwitch(slug, !value);
        setError(e?.message || __('Could not change the switch.', 'subtleforms'));
      }
      setBusy((current) => ({ ...current, [slug]: false }));
    },
    [open, setSwitch, setServiceEnabled]
  );

  const current = active ? services.find((s) => s.slug === active) : null;

  return (
    <div className='sf-ext-panel sf-em'>
      {current ? (
        <ServiceDetail
          key={current.slug}
          service={current}
          enabled={!!enabled[current.slug]}
          onToggle={setSwitch}
          onBack={() => open('')}
        />
      ) : (
        <>
          <SectionHeader
            title={__('Email marketing', 'subtleforms')}
            description={__(
              'Add people who fill in a form to your email list. Switch a service on, connect your account, then turn it on for each form under Form settings > Integrations.',
              'subtleforms'
            )}
          />
          {error && (
            <p role='alert' className='sf-em-detail__error'>
              {error}
            </p>
          )}
          <ServiceGrid services={services} enabled={enabled} busy={busy} onOpen={open} onToggle={toggleFromGrid} />
          <ProBanner />
        </>
      )}
    </div>
  );
}

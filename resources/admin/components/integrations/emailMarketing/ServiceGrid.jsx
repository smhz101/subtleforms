import { __ } from '@wordpress/i18n';
import ServiceTileGrid from '../serviceTiles/ServiceTileGrid';
import { pageData } from './api';

/**
 * The line under a service's logo when it needs something before it can be
 * used. Only services that live on the same site (MailPoet) have one.
 *
 * @param {Object} entry The server's entry for the service.
 * @return {string} Text, or '' for none.
 */
export function statusLabelFor(entry) {
  switch (entry?.local_state) {
    case 'not_installed':
      return __('Not installed', 'subtleforms');
    case 'inactive':
      return __('Not active', 'subtleforms');
    default:
      return '';
  }
}

/**
 * The Email marketing tiles: the shared tile grid (the one an add-on gets as
 * `ServiceTileGrid`) fed with the registered services.
 *
 * @param {Object}   props
 * @param {Array}    props.services Registered services to show.
 * @param {Object}   props.enabled  Map of slug to whether the service is on.
 * @param {Function} props.onOpen   Called with the slug when a tile is clicked.
 * @param {Function} props.onToggle Called with (slug, enabled) when a switch is used.
 * @param {Object}   props.busy     Map of slug to true while its switch is being saved.
 */
export default function ServiceGrid({ services, enabled, onOpen, onToggle, busy = {} }) {
  const server = pageData().services;
  const items = services.map((service) => ({
    slug: service.slug,
    label: service.label,
    logo: service.icon,
    brandColor: service.brandColor,
    enabled: !!enabled[service.slug],
    statusLabel: statusLabelFor(server[service.slug]),
  }));
  return <ServiceTileGrid services={items} busy={busy} onOpen={onOpen} onToggle={onToggle} />;
}

import { FormToggle } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import ServiceLogo from './ServiceLogo';
import './serviceTiles.scss';

/**
 * The accessible name of a tile's switch.
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

/**
 * A grid of service tiles: one cell per service with no gap and one shared
 * line between cells, the logo in the middle (in colour while the service is
 * on, grey while it is off, in colour again on hover or focus) and the switch
 * in the top right corner. Four columns, two on a tablet, one on a phone.
 *
 * The tile is a button that opens the service. The switch is a separate
 * control next to it, so it works on its own.
 *
 * Public: add-ons reach it as `window.SubtleFormsExtend.ServiceTileGrid`.
 *
 * The column count is min(tiles, 4) on a wide screen and min(tiles, 2) on a tablet, so a grid
 * of three has three equal columns and never leaves an empty cell.
 *
 * @param {Object}   props
 * @param {Array}    props.services    [{ slug, label, logo, brandColor, enabled, statusLabel }].
 *                                     `logo` is a component receiving { size } or an element; without
 *                                     one the label is written in `brandColor`. `statusLabel` is a small
 *                                     muted line under the logo.
 * @param {Function} props.onOpen      Called with the slug when a tile is clicked.
 * @param {Function} props.onToggle    Called with (slug, enabled) when a switch is used.
 * @param {Object}   props.busy        Map of slug to true while its switch is being saved.
 * @param {Function} props.toggleLabel Optional (label) => accessible name of a switch.
 */
export function columnCounts(count) {
  const n = Math.max(1, Number(count) || 1);
  return { wide: Math.min(n, 4), medium: Math.min(n, 2) };
}

export default function ServiceTileGrid({ services = [], onOpen, onToggle, busy = {}, toggleLabel = enableLabel }) {
  const { wide, medium } = columnCounts(services.length);
  return (
    <div className='sf-svc-grid-wrap'>
      <ul className={`sf-svc-grid sf-svc-grid--cols-${wide}`} style={{ '--sf-svc-cols': wide, '--sf-svc-cols-medium': medium }}>
        {services.map((service) => {
          const on = !!service.enabled;
          return (
            <li key={service.slug} className={`sf-svc-tile${on ? ' is-on' : ''}`} data-service={service.slug}>
              <button type='button' className='sf-svc-tile__open' onClick={() => onOpen && onOpen(service.slug)}>
                <ServiceLogo logo={service.logo} label={service.label} brandColor={service.brandColor} enabled={on} />
                {service.statusLabel ? <span className='sf-svc-tile__status'>{service.statusLabel}</span> : null}
                <span className='sf-sr-only'>{service.label}</span>
              </button>
              <span className='sf-svc-tile__toggle'>
                <FormToggle
                  checked={on}
                  disabled={!!busy[service.slug]}
                  aria-label={toggleLabel(service.label)}
                  onChange={(e) => onToggle && onToggle(service.slug, e.target.checked)}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

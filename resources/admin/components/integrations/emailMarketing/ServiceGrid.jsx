import { FormToggle } from '@wordpress/components';
import { enableLabel } from './ServiceDetail';
import './emailMarketing.scss';

/**
 * The service tiles: one cell per service, no gap between cells, the logo in
 * the middle (grey; the brand colour while the service is on or the tile is
 * hovered or focused) and the switch in the top right corner.
 *
 * The tile is a button that opens the service; the switch is a separate
 * control, not inside the button, so it can be used on its own.
 *
 * @param {Object}   props
 * @param {Array}    props.services Registered services to show.
 * @param {Object}   props.enabled  Map of slug to whether the service is on.
 * @param {Function} props.onOpen   Called with the slug when a tile is clicked.
 * @param {Function} props.onToggle Called with (slug, enabled) when a switch is used.
 * @param {Object}   props.busy     Map of slug to true while its switch is being saved.
 */
export default function ServiceGrid({ services, enabled, onOpen, onToggle, busy = {} }) {
  return (
    <div className='sf-em-grid-wrap'>
      <ul className='sf-em-grid'>
        {services.map((service) => {
          const Logo = service.icon;
          const on = !!enabled[service.slug];
          return (
            <li
              key={service.slug}
              className={`sf-em-tile${on ? ' is-on' : ''}`}
              data-service={service.slug}
              style={service.brandColor ? { '--sf-em-brand': service.brandColor } : undefined}>
              <button type='button' className='sf-em-tile__open' onClick={() => onOpen(service.slug)}>
                <span className='sf-em-tile__logo' aria-hidden='true'>
                  {Logo ? <Logo size={44} /> : <span className='sf-em-tile__wordmark'>{service.label}</span>}
                </span>
                <span className='sf-sr-only'>{service.label}</span>
              </button>
              <span className='sf-em-tile__toggle'>
                <FormToggle
                  checked={on}
                  disabled={!!busy[service.slug]}
                  aria-label={enableLabel(service.label)}
                  onChange={(e) => onToggle(service.slug, e.target.checked)}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

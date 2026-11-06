import { Button, FormToggle } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import Icon from '../../../ui/Icon';
import ServiceLogo from './ServiceLogo';
import './serviceTiles.scss';

/**
 * The header of one service's screen: a bordered icon-only back button, the
 * small logo (in colour while the service is on, grey while it is off), the
 * name and the switch on the right.
 *
 * Public: add-ons reach it as `window.SubtleFormsExtend.ServiceDetailHeader`.
 *
 * @param {Object}   props
 * @param {string}   props.label       Service name.
 * @param {Function} props.logo        Logo component receiving { size }, or an element.
 * @param {string}   props.brandColor  Colour of the name when there is no logo.
 * @param {boolean}  props.enabled     Whether the service is on.
 * @param {Function} props.onBack      Back to the grid.
 * @param {Function} props.onToggle    Called with the new state of the switch.
 * @param {string}   props.toggleLabel Accessible name of the switch (default "Enable <name>").
 * @param {string}   props.backLabel   Accessible name of the back button.
 * @param {boolean}  props.busy        The switch is being saved.
 * @param {string}   props.id          Id of the switch, so a label can point at it.
 */
export default function ServiceDetailHeader({ label, logo, brandColor, enabled, onBack, onToggle, toggleLabel, backLabel, busy = false, id }) {
  const toggleId = id || `sf-svc-toggle-${String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <header className='sf-svc-head'>
      <Button
        className='sf-svc-head__back'
        icon={<Icon.ArrowLeft size={16} aria-hidden='true' />}
        label={backLabel || __('Back', 'subtleforms')}
        onClick={onBack}
      />
      <span className='sf-svc-head__logo'>
        {logo ? <ServiceLogo logo={logo} label={label} brandColor={brandColor} enabled={!!enabled} size={24} /> : null}
      </span>
      <h3 className='sf-svc-head__title'>{label}</h3>
      <span className='sf-svc-head__switch'>
        <label htmlFor={toggleId} className='sf-svc-head__switch-label'>
          {enabled ? __('Enabled', 'subtleforms') : __('Disabled', 'subtleforms')}
        </label>
        <FormToggle
          id={toggleId}
          checked={!!enabled}
          disabled={!!busy}
          aria-label={toggleLabel || undefined}
          onChange={(e) => onToggle && onToggle(e.target.checked)}
        />
      </span>
    </header>
  );
}

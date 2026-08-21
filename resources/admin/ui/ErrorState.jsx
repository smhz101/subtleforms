/**
 * ErrorState — Reusable error and empty-state component.
 *
 * @param {Object}   props
 * @param {'network_error'|'permission_error'|'empty_state'} [props.variant='network_error']
 * @param {string}   [props.title]        Override the default title for the variant.
 * @param {string}   [props.description]  Override the default description.
 * @param {Function} [props.onRetry]      If provided, shows a primary "Retry" button.
 * @param {Function} [props.onRefresh]    If provided, shows a secondary "Refresh Page" button.
 */

import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import Icon from './Icon';

const VARIANT_DEFAULTS = {
  network_error: {
    Icon: Icon.AlertCircle,
    title: __( 'Unable to connect', 'subtleforms' ),
    description: __( 'Check your connection and try again.', 'subtleforms' ),
  },
  permission_error: {
    Icon: Icon.Lock,
    title: __( 'Access denied', 'subtleforms' ),
    description: __( 'You do not have permission to view this content.', 'subtleforms' ),
  },
  empty_state: {
    Icon: Icon.Package,
    title: __( 'Nothing here yet', 'subtleforms' ),
    description: __( 'Once items are added, they will appear here.', 'subtleforms' ),
  },
};

export default function ErrorState( {
  variant = 'network_error',
  title,
  description,
  onRetry,
  onRefresh,
} ) {
  const defaults = VARIANT_DEFAULTS[ variant ] || VARIANT_DEFAULTS.network_error;
  const IconCmp  = defaults.Icon;

  return (
    <div className='sf-error-state'>
      <div className='sf-error-state__icon'>
        <IconCmp size={ 32 } />
      </div>
      <h3 className='sf-error-state__title'>
        { title || defaults.title }
      </h3>
      <p className='sf-error-state__description'>
        { description || defaults.description }
      </p>
      { ( onRetry || onRefresh ) && (
        <div className='sf-error-state__actions'>
          { onRetry && (
            <Button variant='primary' onClick={ onRetry }>
              { __( 'Retry', 'subtleforms' ) }
            </Button>
          ) }
          { onRefresh && (
            <Button variant='secondary' onClick={ onRefresh }>
              { __( 'Refresh Page', 'subtleforms' ) }
            </Button>
          ) }
        </div>
      ) }
    </div>
  );
}

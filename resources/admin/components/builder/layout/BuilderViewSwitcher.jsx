import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import Icon from '../../../ui/Icon';

/**
 * Segmented control in the centre of the builder bar: Build, Settings,
 * Entries, Preview. Arrow keys move between views (WAI-ARIA tabs pattern).
 */
const VIEWS = [
  { key: 'build', label: __('Build', 'subtleforms'), icon: Icon.LayoutGrid },
  { key: 'settings', label: __('Settings', 'subtleforms'), icon: Icon.Settings },
  {
    key: 'entries',
    label: __('Entries', 'subtleforms'),
    icon: Icon.Inbox,
    className: 'data-tour-submissions-tab',
  },
  { key: 'preview', label: __('Preview', 'subtleforms'), icon: Icon.Eye },
];

export default function BuilderViewSwitcher({ value, onChange }) {
  const onKeyDown = (event) => {
    const index = VIEWS.findIndex((v) => v.key === value);
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      const next = VIEWS[(index + delta + VIEWS.length) % VIEWS.length];
      onChange(next.key);
      requestAnimationFrame(() => {
        document.getElementById(`sf-builder-view-${next.key}`)?.focus();
      });
    }
  };

  return (
    <div
      className='sf-view-switcher'
      role='tablist'
      aria-label={__('Builder view', 'subtleforms')}
      onKeyDown={onKeyDown}>
      {VIEWS.map((view) => {
        const ViewIcon = view.icon;
        const selected = value === view.key;
        return (
          <button
            key={view.key}
            id={`sf-builder-view-${view.key}`}
            type='button'
            role='tab'
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={clsx('sf-view-switcher__item', view.className, {
              'is-active': selected,
            })}
            onClick={() => onChange(view.key)}>
            <ViewIcon size={15} aria-hidden='true' />
            <span>{view.label}</span>
          </button>
        );
      })}
    </div>
  );
}

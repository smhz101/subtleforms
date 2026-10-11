import { __ } from '@wordpress/i18n';
import { useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import Icon from '../ui/Icon';

/**
 * Primary navigation for the SubtleForms frame.
 *
 * Every item is a real link to its wp-admin URL, so middle-click and "open in
 * new tab" behave like any other admin link. A plain click is intercepted and
 * routed inside the app, which makes switching sections instant.
 */
export const NAV_ITEMS = [
  {
    key: 'dashboard',
    path: '/',
    page: 'subtleforms',
    label: __('Dashboard', 'subtleforms'),
    icon: Icon.LayoutDashboard,
    match: (pathname) => pathname === '/',
  },
  {
    key: 'forms',
    path: '/forms',
    page: 'subtleforms-forms',
    label: __('Forms', 'subtleforms'),
    icon: Icon.FileText,
    match: (pathname) => pathname.startsWith('/forms'),
  },
  {
    key: 'submissions',
    path: '/submissions',
    page: 'subtleforms-submissions',
    label: __('Submissions', 'subtleforms'),
    icon: Icon.Inbox,
    match: (pathname) => pathname.startsWith('/submissions'),
    count: () => Number(window.subtleformsAdmin?.unreadCount || 0),
  },
  {
    key: 'extensions',
    path: '/extensions',
    page: 'subtleforms-extensions',
    label: __('Extensions', 'subtleforms'),
    icon: Icon.Puzzle,
    match: (pathname) => pathname.startsWith('/extensions'),
  },
  {
    key: 'settings',
    path: '/settings',
    page: 'subtleforms-settings',
    label: __('Settings', 'subtleforms'),
    icon: Icon.Settings,
    match: (pathname) => pathname.startsWith('/settings'),
  },
];

export default function AppNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      className='sf-appnav'
      aria-label={__('SubtleForms', 'subtleforms')}>
      <ul className='sf-appnav__list'>
        {NAV_ITEMS.map((item) => {
          const isActive = item.match(location.pathname);
          const count = item.count ? item.count() : 0;
          const ItemIcon = item.icon;

          return (
            <li key={item.key} className='sf-appnav__item'>
              <a
                href={`admin.php?page=${item.page}`}
                className={clsx('sf-appnav__link', {
                  'is-active': isActive,
                })}
                aria-current={isActive ? 'page' : undefined}
                onClick={(event) => {
                  if (
                    event.defaultPrevented ||
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                  ) {
                    return;
                  }
                  event.preventDefault();
                  navigate(item.path);
                }}>
                <ItemIcon className='sf-appnav__icon' size={16} aria-hidden='true' />
                <span className='sf-appnav__label'>{item.label}</span>
                {count > 0 && (
                  <span className='sf-appnav__count'>
                    {count > 99 ? '99+' : count}
                    <span className='screen-reader-text'>
                      {' '}
                      {__('unread', 'subtleforms')}
                    </span>
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

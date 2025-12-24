import { __ } from '@wordpress/i18n';
import AdminHeader from './AdminHeader';
import ActionBar from './ActionBar';
import Notices from './Notices';

/**
 * Canonical Admin Shell Layout
 *
 * All SubtleForms admin pages must use this component for consistent UX.
 *
 * Structure:
 * - Top Bar (sticky): Logo, page title, actions (via AdminHeader component)
 * - Action Bar (sticky): Filters, tabs, search (via ActionBar component)
 * - Content Area: Calculated height, scrollable
 * - Bottom Bar: Pagination (if provided)
 */
export default function AdminShell({
  title,
  actions,
  actionBarLeft,
  actionBarRight,
  children,
  pagination,
  noScroll = false,
}) {
  const TOP_BAR_HEIGHT = 60;
  const ACTION_BAR_HEIGHT = actionBarLeft || actionBarRight ? 56 : 0;
  const WP_ADMIN_BAR_HEIGHT = 32;

  return (
    <div className='subtleforms-admin'>
      {/* Remove default WordPress page wrapper styling */}
      <style>{`
        .subtleforms-admin-page .wrap {
          margin: 0 !important;
          padding: 0 !important;
        }
        .subtleforms-admin-page #wpbody-content {
          padding-bottom: 0 !important;
        }
        .subtleforms-admin-page #wpcontent {
          padding: 0 !important;
        }
        /* Handle Admin Bar Height */
        :root {
          --wp-admin--admin-bar--height: 32px;
        }
        @media (max-width: 782px) {
          :root {
            --wp-admin--admin-bar--height: 46px;
          }
        }
      `}</style>

      <div className='flex flex-col bg-white h-[calc(100vh-var(--wp-admin--admin-bar--height,32px))]'>
        {/* TOP BAR - Sticky Header Component */}
        <AdminHeader title={title} actions={actions} />

        {/* ACTION BAR - Sticky ActionBar Component */}
        {(actionBarLeft || actionBarRight) && (
          <div
            className='flex-shrink-0'
            style={{
              position: 'sticky',
              top: `${WP_ADMIN_BAR_HEIGHT + TOP_BAR_HEIGHT}px`,
              zIndex: 99,
            }}>
            <ActionBar left={actionBarLeft} right={actionBarRight} />
          </div>
        )}

        {/* CONTENT AREA - Scrollable */}
        <div className='flex-1 overflow-hidden'>
          <div
            className={`h-full flex flex-col ${
              noScroll ? 'overflow-hidden' : 'overflow-y-auto'
            }`}>
            <div className='empty:hidden flex-shrink-0 px-6 pt-4'>
              <Notices />
            </div>
            <div className={`flex-1 ${noScroll ? 'overflow-hidden' : ''}`}>
              {children}
            </div>
          </div>
        </div>

        {/* BOTTOM BAR - Pagination */}
        {pagination && (
          <div className='flex-shrink-0 bg-white px-6 py-3 border-gray-200 border-t'>
            {pagination}
          </div>
        )}
      </div>
    </div>
  );
}

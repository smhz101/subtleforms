import { __ } from '@wordpress/i18n';
import AdminHeader from './AdminHeader';
import ActionBar from './ActionBar';
import Notices from './Notices';
import './AdminShell.scss';

/**
 * Canonical Admin Shell Layout
 *
 * MANDATORY: All SubtleForms admin pages must use this component for consistent UX.
 *
 * Features:
 * - Full-width layout (overrides WordPress .wrap spacing)
 * - Sticky top header with logo, title, and contextual actions
 * - Optional sticky action bar for filters/search
 * - Fixed viewport height with internal scrolling (not body scroll)
 * - Consistent spacing and typography across all admin pages
 *
 * Structure:
 * - Top Bar (sticky 60px): Logo, page title, actions (via AdminHeader component)
 * - Action Bar (sticky 56px): Filters, tabs, search (via ActionBar component)
 * - Content Area: Viewport-based height, scrollable
 * - Bottom Bar: Optional pagination
 *
 * Used By:
 * - All Forms page (FormsPage.jsx)
 * - Form Builder page (FormBuilderPage.jsx)
 * - Submissions list page (SubmissionsPage.jsx)
 * - Submission detail page (SubmissionDetailPage.jsx)
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
      <div className='sf-flex sf-flex-col sf-bg-white sf-h-[calc(100vh-var(--wp-admin--admin-bar--height,32px))] testig'>
        {/* TOP BAR - Sticky Header Component */}
        <AdminHeader title={title} actions={actions} />

        {/* ACTION BAR - Sticky ActionBar Component */}
        {(actionBarLeft || actionBarRight) && (
          <div
            className='sf-flex-shrink-0'
            style={{
              position: 'sticky',
              top: `${WP_ADMIN_BAR_HEIGHT}px`,
              zIndex: 99,
            }}>
            <ActionBar left={actionBarLeft} right={actionBarRight} />
          </div>
        )}

        {/* CONTENT AREA - Scrollable */}
        <div className='sf-flex-1 sf-overflow-hidden'>
          <div
            className={`h-full flex flex-col ${
              noScroll ? 'overflow-hidden' : 'overflow-y-auto'
            }`}>
            <div className='empty:hidden sf-flex-shrink-0 sf-px-6 sf-pt-4'>
              <Notices />
            </div>
            <div className={`flex-1 ${noScroll ? 'overflow-hidden' : ''}`}>
              {children}
            </div>
          </div>
        </div>

        {/* BOTTOM BAR - Pagination */}
        {pagination && (
          <div className='sf-flex-shrink-0 sf-bg-white sf-px-6 sf-py-3 sf-border-gray-300 sf-border-t'>
            {pagination}
          </div>
        )}
      </div>
    </div>
  );
}

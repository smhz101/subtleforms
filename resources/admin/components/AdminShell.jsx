import { __ } from '@wordpress/i18n';
import { Spinner, Notice, Button } from '@wordpress/components';
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
 * - Editable title support
 *
 * Structure:
 * - Top Bar (sticky 48px): Logo, page title, actions (via AdminHeader component)
 * - Action Bar (sticky 56px): Filters, tabs, search (via ActionBar component)
 * - Content Area: Viewport-based height, scrollable
 * - Bottom Bar: Optional pagination
 *
 * Loading, error and empty states are props rather than something each page
 * builds for itself. Pages used to return their own markup for these, and
 * several returned it *instead of* the shell — so the header, title and actions
 * vanished while data loaded and reappeared afterwards. Rendering them here
 * keeps the chrome still.
 *
 * Used by every admin page.
 */
export default function AdminShell({
  title,
  actions,
  actionBarLeft,
  actionBarRight,
  children,
  pagination,
  noScroll = false,
  editableTitle = false,
  onTitleChange,
  isLoading = false,
  loadingLabel,
  error = null,
  onRetry,
  isEmpty = false,
  empty = null,
}) {
  const TOP_BAR_HEIGHT = 48;
  const ACTION_BAR_HEIGHT = actionBarLeft || actionBarRight ? 56 : 0;
  const WP_ADMIN_BAR_HEIGHT = 32;

  const renderBody = () => {
    if (isLoading) {
      return (
        <div className='sf-admin-shell__state' role='status' aria-live='polite'>
          <Spinner />
          <p>{loadingLabel || __('Loading…', 'subtleforms')}</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className='sf-admin-shell__state'>
          <Notice status='error' isDismissible={false}>
            {typeof error === 'string'
              ? error
              : error?.message ||
                __('Something went wrong loading this page.', 'subtleforms')}
          </Notice>
          {onRetry && (
            <Button variant='primary' onClick={onRetry}>
              {__('Try again', 'subtleforms')}
            </Button>
          )}
        </div>
      );
    }

    if (isEmpty && empty) {
      return <div className='sf-admin-shell__state'>{empty}</div>;
    }

    return children;
  };

  return (
    <div className='subtleforms-admin sf-admin-shell'>
      <div className='sf-admin-shell__container'>
        {/* TOP BAR - Sticky Header Component */}
        <AdminHeader
          title={title}
          actions={actions}
          editableTitle={editableTitle}
          onTitleChange={onTitleChange}
        />

        {/* ACTION BAR - Sticky ActionBar Component */}
        {(actionBarLeft || actionBarRight) && (
          <div
            className='sf-admin-shell__action-bar-wrapper'
            style={{
              position: 'sticky',
              top: `${WP_ADMIN_BAR_HEIGHT}px`,
              zIndex: 99,
            }}>
            <ActionBar left={actionBarLeft} right={actionBarRight} />
          </div>
        )}

        {/* CONTENT AREA - Scrollable */}
        <div className='sf-admin-shell__content'>
          <div
            className={`sf-admin-shell__content-inner ${
              noScroll ? 'sf-admin-shell__content-inner--no-scroll' : ''
            }`}>
            <Notices />
            <div
              className={`sf-admin-shell__content-body ${
                noScroll ? 'sf-admin-shell__content-body--no-scroll' : ''
              }`}>
              {renderBody()}
            </div>
          </div>
        </div>

        {/* BOTTOM BAR - Pagination */}
        {pagination && (
          <div className='sf-admin-shell__pagination'>{pagination}</div>
        )}
      </div>
    </div>
  );
}

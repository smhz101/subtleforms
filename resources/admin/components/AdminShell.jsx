import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Spinner, Notice, Button } from '@wordpress/components';
import clsx from 'clsx';
import AdminHeader from './AdminHeader';
import ActionBar from './ActionBar';
import Notices from './Notices';
import SiteNotices from './SiteNotices';
import AdminFooter from './AdminFooter';
import { ShellFooterProvider } from './ShellFooterContext';
import ImportOfferNotice from './ImportOfferNotice';
import ImportOfferModal from './ImportOfferModal';
import PageHeader from './pageHeader/PageHeader';
import { PageHeaderProvider } from './pageHeader/PageHeaderContext';
import './AdminShell.scss';

/**
 * AdminShell, the SubtleForms frame.
 *
 * Every admin screen renders inside this component. It reproduces the layout
 * WordPress 7 uses for its own app screens (Fonts, Site Editor): a white stage
 * with rounded corners floating in the dark admin chrome, a fixed top bar, and
 * one scroll container for the page.
 *
 *   ┌ stage ──────────────────────────────────────────────┐
 *   │ top bar   logo · navigation · plan · help           │
 *   ├─────────────────────────────────────────────────────┤
 *   │ page header   title / description        actions    │  ← scrolls
 *   │ toolbar       tabs · filters        search (sticky) │
 *   │ body                                                │
 *   ├─────────────────────────────────────────────────────┤
 *   │ footer   page controls (pagination)   version · links│
 *   └─────────────────────────────────────────────────────┘
 *
 * Notices from WordPress and other plugins are collected into a region at the
 * top of the scrolling area, under the header (see SiteNotices). The footer
 * is part of the app screens only; the builder keeps its full height.
 *
 * The `editor` variant swaps the navigation for a focused builder bar and hands
 * scrolling to the builder's own panels.
 *
 * Loading, error and empty states are props rather than something each page
 * builds for itself, so the chrome never disappears while data loads.
 */
export default function AdminShell({
  variant = 'app',
  title,
  description,
  eyebrow,
  meta,
  actions,
  actionBarLeft,
  actionBarRight,
  children,
  pagination,
  noScroll = false,
  editableTitle = false,
  onTitleChange,
  backTo,
  onBack,
  centerSlot,
  width = 'full',
  isLoading = false,
  loadingLabel,
  error = null,
  onRetry,
  isEmpty = false,
  empty = null,
}) {
  const isEditor = variant === 'editor';
  // The footer's page slot. Components such as the list tables draw their
  // pagination into it (see ShellFooterContext).
  const [footerSlot, setFooterSlot] = useState(null);
  // The page header's actions area, for buttons a page draws from its body
  // (PageHeaderActions).
  const [actionsSlot, setActionsSlot] = useState(null);
  const hasToolbar = !!(actionBarLeft || actionBarRight);
  const hasPageHeader = !isEditor && !!(title || actions || description);

  const renderBody = () => {
    if (isLoading) {
      return (
        <div className='sf-app__state' role='status' aria-live='polite'>
          <Spinner />
          <p>{loadingLabel || __('Loading…', 'subtleforms')}</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className='sf-app__state'>
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
      return <div className='sf-app__state'>{empty}</div>;
    }

    return children;
  };

  return (
    <ShellFooterProvider value={isEditor ? undefined : footerSlot}>
    <PageHeaderProvider value={isEditor ? undefined : actionsSlot}>
    <div
      className={clsx('subtleforms-admin', 'sf-app', `sf-app--${variant}`, {
        'sf-app--fixed': noScroll,
      })}>
      <div className='sf-app__stage'>
        <AdminHeader
          variant={isEditor ? 'editor' : 'app'}
          title={isEditor ? title : undefined}
          actions={isEditor ? actions : undefined}
          editableTitle={editableTitle}
          onTitleChange={onTitleChange}
          backTo={backTo}
          onBack={onBack}
          centerSlot={isEditor ? centerSlot : undefined}
        />

        <main
          className={clsx('sf-app__main', { 'is-fixed': noScroll })}
          id='sf-main'
          tabIndex={-1}>
          <SiteNotices>
            <Notices />
          </SiteNotices>

          {hasPageHeader && (
            <PageHeader
              title={title}
              description={description}
              actions={actions}
              meta={meta}
              breadcrumb={eyebrow}
              actionsRef={setActionsSlot}
            />
          )}

          {hasToolbar && (
            <div className='sf-app__toolbar'>
              <ActionBar left={actionBarLeft} right={actionBarRight} />
            </div>
          )}

          <ImportOfferNotice />
          <ImportOfferModal />

          <div
            className={clsx('sf-app__body', {
              'is-fixed': noScroll,
              'sf-app__body--narrow': width === 'narrow',
            })}>
            {renderBody()}
          </div>
        </main>

        {!isEditor && (
          <AdminFooter slotRef={setFooterSlot}>{pagination}</AdminFooter>
        )}
      </div>
    </div>
    </PageHeaderProvider>
    </ShellFooterProvider>
  );
}

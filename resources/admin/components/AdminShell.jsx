import { __ } from '@wordpress/i18n';
import { Spinner, Notice, Button } from '@wordpress/components';
import clsx from 'clsx';
import AdminHeader from './AdminHeader';
import ActionBar from './ActionBar';
import Notices from './Notices';
import ImportOfferNotice from './ImportOfferNotice';
import ImportOfferModal from './ImportOfferModal';
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
 *   └─────────────────────────────────────────────────────┘
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
          {hasPageHeader && (
            <div
              className={clsx('sf-page-header', {
                'sf-page-header--narrow': width === 'narrow',
                'has-toolbar': hasToolbar,
              })}>
              <div className='sf-page-header__main'>
                {eyebrow && (
                  <div className='sf-page-header__eyebrow'>{eyebrow}</div>
                )}
                {title &&
                  (typeof title === 'string' ? (
                    <h1 className='sf-page-header__title'>{title}</h1>
                  ) : (
                    <div className='sf-page-header__title'>{title}</div>
                  ))}
                {description && (
                  <p className='sf-page-header__description'>{description}</p>
                )}
              </div>
              {actions && (
                <div className='sf-page-header__actions'>{actions}</div>
              )}
            </div>
          )}

          {hasToolbar && (
            <div className='sf-app__toolbar'>
              <ActionBar left={actionBarLeft} right={actionBarRight} />
            </div>
          )}

          <Notices />
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

        {pagination && <footer className='sf-app__footer'>{pagination}</footer>}
      </div>
    </div>
  );
}

import { createPortal } from '@wordpress/element';
import clsx from 'clsx';
import usePhoneLayout from '../../hooks/usePhoneLayout';
import { usePageHeaderActionsSlot } from './PageHeaderContext';
import './PageHeader.scss';

/**
 * The header every SubtleForms page has.
 *
 * One row: the title (with an optional count or status chip after it) on the
 * left, the page's actions on the right. An optional one-line description sits
 * under the row, and an optional breadcrumb above the title for sub-pages
 * (a single entry, a form's reports).
 *
 * Buttons in `actions` follow one rule: the primary action is the rightmost
 * and is the only `isPrimary` button; the others are `isSecondary`.
 *
 * Public: add-ons reach it as `window.SubtleFormsExtend.PageHeader` (available
 * since 2.7.5; check `typeof PageHeader === 'function'`).
 *
 * @param {Object}          props
 * @param {string|Node}     props.title       Page title (the h1).
 * @param {string}          props.description One line under the row.
 * @param {Node}            props.actions     Buttons on the right.
 * @param {Node}            props.meta        Count or status chip after the title.
 * @param {Node}            props.breadcrumb  Node above the title.
 * @param {Function}        props.actionsRef  Receives the actions element (for PageHeaderActions).
 * @param {string}          props.className   Extra class.
 */
export default function PageHeader({
  title,
  description,
  actions,
  meta,
  breadcrumb,
  actionsRef,
  className,
}) {
  const isPhone = usePhoneLayout();
  const hasActions = !!actions || !!actionsRef;

  return (
    <div className={clsx('sf-page-header', className, { 'is-phone': isPhone })}>
      {breadcrumb ? <div className='sf-page-header__breadcrumb'>{breadcrumb}</div> : null}
      <div className='sf-page-header__row'>
        <div className='sf-page-header__heading'>
          {typeof title === 'string' ? (
            <h1 className='sf-page-header__title'>{title}</h1>
          ) : (
            <div className='sf-page-header__title'>{title}</div>
          )}
          {meta ? <span className='sf-page-header__meta'>{meta}</span> : null}
        </div>
        {hasActions ? (
          <div className='sf-page-header__actions' ref={actionsRef}>
            {actions}
          </div>
        ) : null}
      </div>
      {description ? <p className='sf-page-header__description'>{description}</p> : null}
    </div>
  );
}

/**
 * Put buttons into the page header from inside a page's body.
 *
 * A page that draws inside the SubtleForms frame (an add-on page) does not
 * build the header itself, yet its buttons depend on its own state. It renders
 * them with this component and they appear in the header's actions area. With
 * no header around the children stay where they are.
 *
 * Public: `window.SubtleFormsExtend.PageHeaderActions`.
 */
export function PageHeaderActions({ children }) {
  const slot = usePageHeaderActionsSlot();
  if (slot === undefined) {
    return <div className='sf-page-header__inline-actions'>{children}</div>;
  }
  return slot ? createPortal(children, slot) : null;
}

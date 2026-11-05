import { __ } from '@wordpress/i18n';
import ExtensionSlot from './ExtensionSlot';
import './AdminFooter.scss';

export const DOCS_URL = 'https://subtleforms.com/docs/';
export const SUPPORT_URL = 'https://wordpress.org/support/plugin/subtleforms/';

/**
 * The bottom bar of the SubtleForms frame.
 *
 * Left: a slot for page-level controls (list pagination). Right: the plugin
 * version, the Documentation and Support links, and the `footer.meta` slot
 * add-ons can add items to.
 *
 * @param {Object}                   props
 * @param {Function}                 props.slotRef  Receives the page slot element.
 * @param {import('react').ReactNode} props.children Page controls drawn without a portal.
 */
export default function AdminFooter({ slotRef, children }) {
  const version = window.subtleformsAdmin?.version || '';

  return (
    <footer className='sf-footer'>
      <div className='sf-footer__page' ref={slotRef}>
        {children}
      </div>
      <nav className='sf-footer__meta' aria-label={__('SubtleForms', 'subtleforms')}>
        <span className='sf-footer__version'>
          {version ? `SubtleForms ${version}` : 'SubtleForms'}
        </span>
        <ExtensionSlot name='footer.meta' version={version} />
        <a href={DOCS_URL} target='_blank' rel='noopener noreferrer'>
          {__('Documentation', 'subtleforms')}
        </a>
        <a href={SUPPORT_URL} target='_blank' rel='noopener noreferrer'>
          {__('Support', 'subtleforms')}
        </a>
      </nav>
    </footer>
  );
}

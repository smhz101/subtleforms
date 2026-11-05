import { useEffect, useRef, useState, useCallback } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Button } from '@wordpress/components';
import {
  relocateNotices,
  stashNotices,
  foldNotices,
} from '../utils/siteNotices';
import './SiteNotices.scss';

/**
 * The notices region, directly under the SubtleForms header.
 *
 * Notices that WordPress and other plugins print above the app are moved in
 * here, so nothing sits above the header. They are not hidden or removed.
 * Notices added later by a script are moved in as well. The app's own notices
 * (children) share the region.
 */
export default function SiteNotices({ children }) {
  const listRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [foldable, setFoldable] = useState(0);
  const expandedRef = useRef(false);
  expandedRef.current = expanded;

  const sync = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    relocateNotices(list);
    setFoldable(foldNotices(list, !expandedRef.current));
  }, []);

  useEffect(() => {
    const list = listRef.current;
    const body = document.body;
    body.classList.add('sf-notices-managed');
    body.classList.remove('sf-notices-pending');
    sync();

    const observer = new window.MutationObserver(sync);
    const host = document.getElementById('wpbody-content');
    if (host) {
      observer.observe(host, { childList: true });
      host
        .querySelectorAll(':scope > .wrap')
        .forEach((wrap) => observer.observe(wrap, { childList: true }));
    }
    // Dismissed notices leave the list; keep the fold count right.
    observer.observe(list, { childList: true });

    return () => {
      observer.disconnect();
      stashNotices(list);
      body.classList.remove('sf-notices-managed');
    };
  }, [sync]);

  useEffect(() => {
    sync();
  }, [expanded, sync]);

  return (
    <section
      className='sf-site-notices'
      role='region'
      aria-label={__('Notices', 'subtleforms')}>
      <div className='sf-site-notices__list' ref={listRef} />
      {foldable > 0 && (
        <Button
          variant='link'
          className='sf-site-notices__more'
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}>
          {expanded
            ? __('Show fewer notices', 'subtleforms')
            : sprintf(
                /* translators: %d: number of notices that are folded away. */
                _n(
                  'Show %d more notice',
                  'Show %d more notices',
                  foldable,
                  'subtleforms'
                ),
                foldable
              )}
        </Button>
      )}
      {children}
    </section>
  );
}

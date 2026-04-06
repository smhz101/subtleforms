import { useSelect, useDispatch } from '@wordpress/data';
import { NoticeList, SnackbarList } from '@wordpress/components';
import { store as noticesStore } from '@wordpress/notices';
import { createPortal, useMemo } from '@wordpress/element';
import './Notices.scss';

export default function Notices() {
  const notices = useSelect((select) => select(noticesStore).getNotices(), []);
  const { removeNotice } = useDispatch(noticesStore);

  const regularNotices = notices.filter((notice) => notice.type !== 'snackbar');
  const snackbarNotices = notices.filter(
    (notice) => notice.type === 'snackbar'
  );

  // Compute left offset to align with the WP content area (accounts for sidebar width).
  // getBoundingClientRect() on #wpcontent gives the viewport-relative left edge.
  const snackbarLeft = useMemo(() => {
    const el = document.getElementById('wpcontent');
    if (!el) return 20;
    return el.getBoundingClientRect().left + 20;
  }, [snackbarNotices.length]);

  return (
    <>
      {/* Regular notices - inline, only render wrapper when notices exist */}
      {regularNotices.length > 0 && (
        <div className='sf-notices-wrapper'>
          <NoticeList
            className='subtleforms-notices'
            notices={regularNotices}
            onRemove={removeNotice}
          />
        </div>
      )}

      {/* Snackbars - fixed bottom-left portal, aligned to WP content area */}
      {snackbarNotices.length > 0 &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              bottom: '24px',
              left: `${snackbarLeft}px`,
              zIndex: 100000,
            }}>
            <SnackbarList
              className='subtleforms-snackbars'
              notices={snackbarNotices}
              onRemove={removeNotice}
            />
          </div>,
          document.body
        )}
    </>
  );
}

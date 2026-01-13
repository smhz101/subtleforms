import { useSelect, useDispatch } from '@wordpress/data';
import { NoticeList, SnackbarList } from '@wordpress/components';
import { store as noticesStore } from '@wordpress/notices';
import { createPortal } from '@wordpress/element';
import './Notices.scss';

export default function Notices() {
  const notices = useSelect((select) => select(noticesStore).getNotices(), []);
  const { removeNotice } = useDispatch(noticesStore);

  const regularNotices = notices.filter((notice) => notice.type !== 'snackbar');
  const snackbarNotices = notices.filter(
    (notice) => notice.type === 'snackbar'
  );

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

      {/* Snackbars - fixed bottom portal */}
      {snackbarNotices.length > 0 &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              bottom: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 100000,
              pointerEvents: 'none',
            }}>
            <div style={{ pointerEvents: 'auto' }}>
              <SnackbarList
                className='subtleforms-snackbars'
                notices={snackbarNotices}
                onRemove={removeNotice}
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

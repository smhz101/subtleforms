import { useSelect, useDispatch } from '@wordpress/data';
import { NoticeList, SnackbarList } from '@wordpress/components';
import { store as noticesStore } from '@wordpress/notices';

export default function Notices() {
  const notices = useSelect((select) => select(noticesStore).getNotices(), []);
  const { removeNotice } = useDispatch(noticesStore);

  return (
    <>
      <NoticeList
        className='sf-mb-4 subtleforms-notices'
        notices={notices.filter((notice) => notice.type !== 'snackbar')}
        onRemove={removeNotice}
      />
      <SnackbarList
        className='subtleforms-snackbars'
        notices={notices.filter((notice) => notice.type === 'snackbar')}
        onRemove={removeNotice}
      />
    </>
  );
}

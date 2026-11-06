import { Button } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

/** Previous and Next under a log table. */
export default function Pager({ page, pages, setPage }) {
  return (
    <footer className='sf-panel__footer sf-logs__pager'>
      <Button variant='secondary' disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>
        {__('Previous', 'subtleforms')}
      </Button>
      <span className='sf-logs__page'>
        {sprintf(
          /* translators: 1: current page, 2: page count */
          __('Page %1$d of %2$d', 'subtleforms'),
          page,
          pages
        )}
      </span>
      <Button variant='secondary' disabled={page >= pages} onClick={() => setPage((n) => n + 1)}>
        {__('Next', 'subtleforms')}
      </Button>
    </footer>
  );
}

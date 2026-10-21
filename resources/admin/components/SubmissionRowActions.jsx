import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import { Icon } from '../ui';
import IconAction from './IconAction';

/**
 * The action icons of a submission row: view, star, flag, trash (restore and
 * delete permanently in the Trash). Each icon button draws its own tooltip
 * from its own label, so a label never shows over another button.
 *
 * @param {Object} props
 * @param {Object} props.submission The entry row.
 * @param {boolean} props.hardDelete Entries are deleted for good, not trashed.
 * @param {Function} props.onView Open the entry (submission).
 * @param {Function} props.onMark Bulk action on one entry (id, action).
 * @param {Function} props.onRestore Restore from the Trash (id).
 * @param {Function} props.onTrash Move to the Trash (id).
 * @param {Function} props.onDelete Ask to delete permanently (id).
 */
export default function SubmissionRowActions({ submission, hardDelete, onView, onMark, onRestore, onTrash, onDelete }) {
  const isStarred = parseInt(submission.starred, 10) === 1;
  const isFlagged = submission.status === 'flagged';
  const stop = (fn) => (event) => {
    event.stopPropagation();
    fn();
  };

  return (
    <div className='subtleforms-row-actions sf-submissions-table__actions'>
      <IconAction
        label={__('View', 'subtleforms')}
        icon={<Icon.Eye size={16} />}
        onClick={stop(() => onView(submission))}
      />
      <IconAction
        label={isStarred ? __('Remove star', 'subtleforms') : __('Star', 'subtleforms')}
        icon={<Icon.Star size={16} />}
        pressed={isStarred}
        className={clsx('sf-submissions-table__star-btn', isStarred && 'is-starred')}
        onClick={stop(() => onMark(submission.id, isStarred ? 'unstar' : 'star'))}
      />
      <IconAction
        label={isFlagged ? __('Remove flag', 'subtleforms') : __('Flag', 'subtleforms')}
        icon={<Icon.AlertCircle size={16} />}
        pressed={isFlagged}
        className={clsx('sf-submissions-table__flag-btn', isFlagged && 'is-flagged')}
        onClick={stop(() => onMark(submission.id, isFlagged ? 'restore' : 'flagged'))}
      />
      {submission.status === 'trash' ? (
        <>
          <IconAction
            label={__('Restore', 'subtleforms')}
            icon={<Icon.Undo size={16} />}
            onClick={stop(() => onRestore(submission.id))}
          />
          <IconAction
            label={__('Delete permanently', 'subtleforms')}
            icon={<Icon.Trash size={16} />}
            isDestructive
            onClick={stop(() => onDelete(submission.id))}
          />
        </>
      ) : (
        <IconAction
          label={hardDelete ? __('Delete permanently', 'subtleforms') : __('Move to Trash', 'subtleforms')}
          icon={<Icon.Trash size={16} />}
          isDestructive
          onClick={stop(() => (hardDelete ? onDelete(submission.id) : onTrash(submission.id)))}
        />
      )}
    </div>
  );
}

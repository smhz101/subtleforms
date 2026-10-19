/**
 * Field ID in the field settings header: copy it, or change it in place
 * (2.4.1).
 *
 * The ID is the key the field's answers are stored under. A form rebuilt
 * from another tool, or an import that has to match existing data, can give
 * a field the ID it had before. Changing it updates every place the form
 * uses it (merge tags, formulas, logic, integrations, payment settings).
 * Entries already sent keep their answers under the old ID.
 */
import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';
import Icon from '../../ui/Icon';
import { FIELD_KEY_MAX, fieldKeyProblem, tidyFieldKey } from '../../../shared/fieldKeys';
import './FieldKeyEditor.scss';

/**
 * Plain sentence for a problem code from fieldKeyProblem().
 *
 * @param {string} code Problem code.
 * @return {string} Message.
 */
export function fieldKeyMessage(code) {
  switch (code) {
    case 'empty':
      return __('Enter an ID.', 'subtleforms');
    case 'start':
      return __('Start the ID with a letter.', 'subtleforms');
    case 'characters':
      return __('Use lower case letters, numbers, _ and - only.', 'subtleforms');
    case 'long':
      /* translators: %d: longest ID length */
      return sprintf(__('Use %d characters or fewer.', 'subtleforms'), FIELD_KEY_MAX);
    case 'reserved':
      return __('SubtleForms uses this name itself. Choose another.', 'subtleforms');
    case 'taken':
      return __('Another field in this form already uses this ID.', 'subtleforms');
    default:
      return '';
  }
}

/**
 * @param {Object}   props
 * @param {string}   props.nodeId     Selected field node.
 * @param {string}   props.fieldKey   Current ID.
 * @param {Set}      props.usedKeys   IDs of the other fields.
 * @param {Function} props.onRename   (nodeId, newKey) => { references } | null.
 * @param {number}   props.entryCount Entries the form has.
 * @param {boolean}  props.isReadOnly Read-only builder.
 */
export default function FieldKeyEditor({ nodeId, fieldKey, usedKeys, onRename, entryCount = 0, isReadOnly = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fieldKey);
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState(null);
  const inputRef = useRef(null);

  // Another field selected: start fresh.
  useEffect(() => {
    setEditing(false);
    setDone(null);
  }, [nodeId]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const problem = useMemo(
    () => (draft === fieldKey ? '' : fieldKeyProblem(draft, usedKeys)),
    [draft, fieldKey, usedKeys]
  );

  const start = () => {
    setDraft(fieldKey);
    setDone(null);
    setEditing(true);
  };

  const cancel = () => {
    setDraft(fieldKey);
    setEditing(false);
  };

  const apply = () => {
    if (problem) {
      return;
    }
    setEditing(false);
    if (draft === fieldKey) {
      return;
    }
    const result = onRename?.(nodeId, draft);
    if (result) {
      setDone({ oldKey: fieldKey, newKey: draft, references: result.references || 0 });
    }
  };

  const undo = () => {
    if (!done) {
      return;
    }
    onRename?.(nodeId, done.oldKey);
    setDone(null);
  };

  if (editing) {
    const messageId = `sf-field-key-msg-${nodeId}`;
    return (
      <div className='sf-field-key sf-field-key--editing'>
        <div className='sf-field-key__row'>
          <input
            ref={inputRef}
            type='text'
            className={`sf-field-key__input${problem ? ' has-problem' : ''}`}
            value={draft}
            maxLength={FIELD_KEY_MAX + 10}
            spellCheck={false}
            autoComplete='off'
            aria-label={__('Field ID', 'subtleforms')}
            aria-invalid={problem ? 'true' : undefined}
            aria-describedby={messageId}
            onChange={(e) => setDraft(tidyFieldKey(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                apply();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                cancel();
              }
            }}
            onBlur={() => {
              if (!problem) {
                apply();
              }
            }}
          />
        </div>
        <p id={messageId} className={`sf-field-key__hint${problem ? ' is-problem' : ''}`} role={problem ? 'alert' : undefined}>
          {problem
            ? fieldKeyMessage(problem)
            : __('Enter to save, Esc to cancel.', 'subtleforms')}
        </p>
      </div>
    );
  }

  return (
    <div className='sf-field-key'>
      <div className='sf-field-key__row'>
        <button
          type='button'
          className='sf-field-inspector__key'
          title={__('Copy field ID as a merge tag', 'subtleforms')}
          onClick={() => {
            window.navigator?.clipboard?.writeText(`{${fieldKey}}`).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}>
          {copied ? (
            <>
              <Icon.Check size={12} /> {__('Copied', 'subtleforms')}
            </>
          ) : (
            <>
              <code>{fieldKey}</code>
              <Icon.Copy size={12} />
            </>
          )}
        </button>
        {!isReadOnly && onRename && (
          <Button
            size='small'
            className='sf-field-key__edit'
            icon={<Icon.Edit size={12} />}
            label={__('Change field ID', 'subtleforms')}
            showTooltip
            onClick={start}
          />
        )}
      </div>
      {done && (
        <p className='sf-field-key__done' role='status'>
          <span>
            {done.references > 0
              ? sprintf(
                  /* translators: %d: number of merge tags, rules and settings updated */
                  _n('ID changed, %d place updated.', 'ID changed, %d places updated.', done.references, 'subtleforms'),
                  done.references
                )
              : __('ID changed.', 'subtleforms')}
            {entryCount > 0 && (
              <>
                {' '}
                {sprintf(
                  /* translators: %s: previous field ID */
                  __('Earlier entries keep %s.', 'subtleforms'),
                  done.oldKey
                )}
              </>
            )}
          </span>{' '}
          <Button variant='link' className='sf-field-key__undo' onClick={undo}>
            {__('Undo', 'subtleforms')}
          </Button>
        </p>
      )}
    </div>
  );
}

/**
 * Repeater runtime (2.3.1, QA-09).
 *
 * Visitors add and remove complete groups of the Repeater's fields, between
 * the configured minimum and maximum. Each group is independent: its inputs
 * have their own ids and names (`companies[1][ticker]`), its answers live in
 * `values.companies[1]`, its errors and conditional rules are its own.
 *
 * Used by the live form, the builder Preview and the block editor preview,
 * which all mount the same renderer.
 */
import { __, sprintf } from '@wordpress/i18n';
import { useEffect, useRef, useState } from '@wordpress/element';
import { getIn } from '../../utils/valuePaths';
import { repeaterLimits } from '../../utils/fieldValidation';
import { collectDefaultValues } from '../../utils/defaults';

let uidCounter = 0;
const nextUid = () => {
  uidCounter += 1;
  return `g${uidCounter}`;
};

function childrenOf(field) {
  if (Array.isArray(field.children) && field.children.length > 0) return field.children;
  return Array.isArray(field.fields) ? field.fields : [];
}

export default function RepeaterField({
  field,
  config,
  path,
  namePrefix,
  label,
  values,
  onChange,
  errors,
  renderChild,
  appearanceClasses,
  appearanceStyle,
}) {
  const { min, max } = repeaterLimits(field);
  const children = childrenOf(field);
  const stored = getIn(values, path);
  const groups = Array.isArray(stored) ? stored : [];
  const count = groups.length;
  const buttonLabel = config.buttonLabel || __('Add another', 'subtleforms');
  const baseId = `subtleforms-repeater-${String(path).replace(/[^a-zA-Z0-9\-_]/g, '-')}`;
  const error = errors?.[path];

  // Stable keys per group, so removing a middle group never hands its inputs
  // (and any state inside them) to the next group.
  const uidsRef = useRef([]);
  while (uidsRef.current.length < count) uidsRef.current.push(nextUid());
  if (uidsRef.current.length > count) uidsRef.current = uidsRef.current.slice(0, count);

  const groupRefs = useRef({});
  const addRef = useRef(null);
  const [focusTarget, setFocusTarget] = useState(null);
  const [announcement, setAnnouncement] = useState('');

  // Start with the minimum number of groups (and at least one).
  useEffect(() => {
    if (!Array.isArray(stored) || stored.length < Math.max(min, 1)) {
      const defaults = collectDefaultValues(children);
      const padded = [...groups];
      while (padded.length < Math.max(min, 1)) padded.push({ ...defaults });
      onChange(path, padded);
    }
    // Only when the stored list is missing or short.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored === undefined, count < Math.max(min, 1)]);

  // Move focus after the list changed (new group: its first input; removed
  // group: the group that took its place, or the Add button).
  useEffect(() => {
    if (!focusTarget) return;
    const { type, uid } = focusTarget;
    setFocusTarget(null);
    if (type === 'groupBox' && uid && groupRefs.current[uid]) {
      groupRefs.current[uid].focus();
      return;
    }
    if (type === 'group' && uid && groupRefs.current[uid]) {
      const el = groupRefs.current[uid];
      const first = el.querySelector(
        'input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable=true]'
      );
      (first || el).focus();
      return;
    }
    if (addRef.current) {
      addRef.current.focus();
    }
  }, [focusTarget, count]);

  const groupLabel = (index) =>
    sprintf(
      /* translators: 1: repeater label, 2: group number */
      __('%1$s %2$d', 'subtleforms'),
      label || __('Entry', 'subtleforms'),
      index + 1
    );

  const addGroup = () => {
    if (count >= max) return;
    const defaults = collectDefaultValues(children);
    const uid = nextUid();
    uidsRef.current = [...uidsRef.current, uid];
    onChange(path, [...groups, { ...defaults }]);
    setAnnouncement(
      sprintf(
        /* translators: %s: group name, e.g. "Companies 2" */
        __('%s added.', 'subtleforms'),
        groupLabel(count)
      )
    );
    setFocusTarget({ type: 'group', uid });
  };

  const removeGroup = (index) => {
    if (count <= min) return;
    const next = groups.filter((_, i) => i !== index);
    const uids = uidsRef.current.filter((_, i) => i !== index);
    uidsRef.current = uids;
    onChange(path, next);
    setAnnouncement(
      sprintf(
        /* translators: %s: group name, e.g. "Companies 2" */
        __('%s removed.', 'subtleforms'),
        groupLabel(index)
      )
    );
    const focusUid = uids[index] || uids[index - 1] || null;
    setFocusTarget(focusUid ? { type: 'groupBox', uid: focusUid } : { type: 'add' });
  };

  const canAdd = count < max;
  const canRemove = count > min;

  return (
    <div
      className={['subtleforms-field', 'subtleforms-repeater', appearanceClasses].filter(Boolean).join(' ')}
      style={appearanceStyle}
      role='group'
      aria-labelledby={`${baseId}-label`}
      data-repeater={path}>
      <div id={`${baseId}-label`} className='subtleforms-field-label subtleforms-repeater__label'>
        {label}
      </div>
      {config.description && (
        <p className='subtleforms-field-help'>{config.description}</p>
      )}

      <div className='subtleforms-repeater__groups'>
        {groups.map((_, index) => {
          const uid = uidsRef.current[index];
          const legendId = `${baseId}-${uid}-legend`;
          return (
            <fieldset
              key={uid}
              ref={(el) => {
                if (el) groupRefs.current[uid] = el;
                else delete groupRefs.current[uid];
              }}
              className='subtleforms-repeater__group'
              data-group-index={index}
              tabIndex={-1}
              aria-labelledby={legendId}>
              <div className='subtleforms-repeater__group-header'>
                <legend id={legendId} className='subtleforms-repeater__legend'>
                  {groupLabel(index)}
                </legend>
                {canRemove && (
                  <button
                    type='button'
                    className='subtleforms-repeater__remove'
                    onClick={() => removeGroup(index)}
                    aria-label={sprintf(
                      /* translators: %s: group name, e.g. "Companies 2" */
                      __('Remove %s', 'subtleforms'),
                      groupLabel(index)
                    )}>
                    <span aria-hidden='true'>×</span>
                    <span className='subtleforms-repeater__remove-text'>
                      {__('Remove', 'subtleforms')}
                    </span>
                  </button>
                )}
              </div>
              <div className='subtleforms-repeater__fields'>
                {children.map((child) => {
                  const childKey = child.config?.key || child.key;
                  return renderChild(child, {
                    pathPrefix: `${path}.${index}.`,
                    namePrefix: `${namePrefix}[${index}]`,
                    key: `${uid}-${childKey}`,
                  });
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      <div className='subtleforms-repeater__footer'>
        {canAdd ? (
          <button
            ref={addRef}
            type='button'
            className='subtleforms-repeater__add'
            onClick={addGroup}
            aria-describedby={`${baseId}-count`}>
            <span aria-hidden='true'>+</span> {buttonLabel}
          </button>
        ) : null}
        <span id={`${baseId}-count`} className='subtleforms-repeater__count'>
          {canAdd
            ? sprintf(
                /* translators: 1: groups added, 2: maximum groups */
                __('%1$d of %2$d', 'subtleforms'),
                count,
                max
              )
            : sprintf(
                /* translators: %d: maximum groups */
                __('Maximum of %d reached', 'subtleforms'),
                max
              )}
        </span>
      </div>

      {error && (
        <div id={`${baseId}-error`} className='subtleforms-field-error' role='alert'>
          {error}
        </div>
      )}
      <div className='subtleforms-sr-only' aria-live='polite'>
        {announcement}
      </div>
    </div>
  );
}

/**
 * Choices editor for Dropdown, Radio Buttons, Checkboxes and Picture Choice.
 *
 * - Drag the handle (or use Alt+↑/↓) to reorder.
 * - "Show values" reveals the stored value beside each label; values are
 *   generated from labels until you edit them.
 * - Tick the circle/box to make an option selected by default.
 * - "Bulk edit" swaps the list for a textarea (one option per line,
 *   `Label|value` to set a value).
 * - Picture Choice adds an image per option, picked from the Media Library.
 */

import { useState, useMemo } from '@wordpress/element';
import { Button, ToggleControl, TextareaControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { nanoid } from 'nanoid';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Icon from '../../../../ui/Icon';

export const CHOICE_TYPES = ['radio', 'multiple_choice', 'dropdown', 'select', 'picture_choice'];

const slugify = (text) =>
  String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || `option_${nanoid(6)}`;

function openMediaPicker(onSelect) {
  const media = window.wp?.media;
  if (!media) {
    return false;
  }
  const frame = media({
    title: __('Choose image', 'subtleforms'),
    button: { text: __('Use image', 'subtleforms') },
    library: { type: 'image' },
    multiple: false,
  });
  frame.on('select', () => {
    const attachment = frame.state().get('selection').first()?.toJSON();
    if (attachment?.url) {
      onSelect(attachment.sizes?.medium?.url || attachment.url);
    }
  });
  frame.open();
  return true;
}

function OptionRow({
  option,
  index,
  count,
  isDefault,
  multiple,
  showValues,
  withImage,
  disabled,
  onChange,
  onRemove,
  onToggleDefault,
  onMove,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: option._sid, disabled });

  return (
    <li
      ref={setNodeRef}
      className={`sf-options__row${isDragging ? ' is-dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}>
      <button
        type='button'
        className='sf-options__handle'
        aria-label={__('Drag to reorder', 'subtleforms')}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.altKey && e.key === 'ArrowUp' && index > 0) {
            e.preventDefault();
            onMove(index, index - 1);
          }
          if (e.altKey && e.key === 'ArrowDown' && index < count - 1) {
            e.preventDefault();
            onMove(index, index + 1);
          }
        }}
        {...attributes}
        {...listeners}>
        <Icon.Move size={14} />
      </button>

      <button
        type='button'
        className={`sf-options__default${multiple ? ' is-multiple' : ''}${isDefault ? ' is-checked' : ''}`}
        aria-pressed={isDefault}
        aria-label={
          isDefault
            ? __('Selected by default. Click to clear.', 'subtleforms')
            : __('Select by default', 'subtleforms')
        }
        title={__('Selected by default', 'subtleforms')}
        disabled={disabled}
        onClick={onToggleDefault}>
        {isDefault && <Icon.Check size={11} />}
      </button>

      {withImage && (
        <button
          type='button'
          className='sf-options__image'
          disabled={disabled}
          title={__('Choose image', 'subtleforms')}
          onClick={() => {
            const opened = openMediaPicker((url) => onChange({ ...option, image: url }));
            if (!opened) {
              // eslint-disable-next-line no-alert
              const url = window.prompt(__('Image URL', 'subtleforms'), option.image || '');
              if (url !== null) onChange({ ...option, image: url });
            }
          }}>
          {option.image ? <img src={option.image} alt='' /> : <Icon.Image size={14} />}
        </button>
      )}

      <div className='sf-options__inputs'>
        <input
          type='text'
          className='sf-options__input'
          value={option.label ?? ''}
          placeholder={__('Label', 'subtleforms')}
          aria-label={sprintf(
            /* translators: %d: option number */
            __('Option %d label', 'subtleforms'),
            index + 1
          )}
          disabled={disabled}
          onChange={(e) => {
            const label = e.target.value;
            const next = { ...option, label };
            // Keep values in step with labels until someone sets a value by hand.
            const auto =
              !option.value ||
              /^option_[A-Za-z0-9_-]{4,}$/.test(option.value) ||
              option.value === slugify(option.label);
            if (auto) next.value = slugify(label);
            onChange(next);
          }}
        />
        {showValues && (
          <input
            type='text'
            className='sf-options__input sf-options__input--value'
            value={option.value ?? ''}
            placeholder={__('Value', 'subtleforms')}
            aria-label={sprintf(
              /* translators: %d: option number */
              __('Option %d value', 'subtleforms'),
              index + 1
            )}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...option, value: e.target.value })
            }
          />
        )}
      </div>

      <Button
        className='sf-options__remove'
        icon={<Icon.Close size={14} />}
        label={__('Remove option', 'subtleforms')}
        size='small'
        disabled={disabled || count <= 1}
        onClick={onRemove}
      />
    </li>
  );
}

export default function OptionsPanel({ field, onUpdate, isReadOnly }) {
  const [showValues, setShowValues] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const options = useMemo(
    () =>
      (Array.isArray(field?.options) ? field.options : []).map((opt, i) => ({
        ...opt,
        _sid: `${opt.value ?? 'opt'}-${i}`,
      })),
    [field?.options]
  );

  if (!field || !CHOICE_TYPES.includes(field.type)) {
    return null;
  }

  const multiple =
    field.type === 'multiple_choice'
      ? field.allowMultiple !== false
      : field.type === 'picture_choice'
        ? field.allowMultiple === true
        : false;
  const withImage = field.type === 'picture_choice';

  const defaults = String(field.defaultValue ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  const strip = (list) =>
    list.map(({ _sid, ...rest }) => rest); // eslint-disable-line no-unused-vars

  const commit = (list) => onUpdate({ options: strip(list) });

  const toggleDefault = (value) => {
    let next;
    if (multiple) {
      next = defaults.includes(value)
        ? defaults.filter((v) => v !== value)
        : [...defaults, value];
    } else {
      next = defaults.includes(value) ? [] : [value];
    }
    onUpdate({ defaultValue: next.join(',') });
  };

  const move = (from, to) => commit(arrayMove(options, from, to));

  const openBulk = () => {
    setBulkText(
      options
        .map((o) => (o.value && o.value !== slugify(o.label) ? `${o.label}|${o.value}` : o.label))
        .join('\n')
    );
    setBulk(true);
  };

  const applyBulk = () => {
    const next = bulkText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [label, value] = line.split('|').map((p) => p.trim());
        const existing = options.find((o) => o.label === label);
        return {
          ...(existing || {}),
          label,
          value: value || existing?.value || slugify(label),
        };
      });
    if (next.length) commit(next);
    setBulk(false);
  };

  return (
    <div className='sf-options'>
      <div className='sf-options__toolbar'>
        <ToggleControl
          __nextHasNoMarginBottom
          label={__('Show values', 'subtleforms')}
          checked={showValues}
          onChange={setShowValues}
          disabled={bulk}
        />
        <Button
          variant='tertiary'
          size='small'
          onClick={bulk ? () => setBulk(false) : openBulk}
          disabled={isReadOnly}>
          {bulk ? __('Cancel', 'subtleforms') : __('Bulk edit', 'subtleforms')}
        </Button>
      </div>

      {bulk ? (
        <div className='sf-options__bulk'>
          <TextareaControl
            __nextHasNoMarginBottom
            label={__('One option per line', 'subtleforms')}
            help={__('Use Label|value to set a stored value.', 'subtleforms')}
            rows={8}
            value={bulkText}
            onChange={setBulkText}
          />
          <Button variant='primary' size='compact' onClick={applyBulk}>
            {__('Apply', 'subtleforms')}
          </Button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={({ active, over }) => {
            if (!over || active.id === over.id) return;
            const from = options.findIndex((o) => o._sid === active.id);
            const to = options.findIndex((o) => o._sid === over.id);
            if (from > -1 && to > -1) move(from, to);
          }}>
          <SortableContext
            items={options.map((o) => o._sid)}
            strategy={verticalListSortingStrategy}>
            <ul className='sf-options__list'>
              {options.map((option, index) => (
                <OptionRow
                  key={option._sid}
                  option={option}
                  index={index}
                  count={options.length}
                  isDefault={defaults.includes(option.value)}
                  multiple={multiple}
                  showValues={showValues}
                  withImage={withImage}
                  disabled={isReadOnly}
                  onMove={move}
                  onChange={(next) => {
                    const list = [...options];
                    list[index] = next;
                    commit(list);
                  }}
                  onRemove={() => commit(options.filter((_, i) => i !== index))}
                  onToggleDefault={() => toggleDefault(option.value)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {!bulk && (
        <Button
          variant='secondary'
          size='compact'
          className='sf-options__add'
          icon={<Icon.Plus size={14} />}
          disabled={isReadOnly}
          onClick={() => {
            const n = options.length + 1;
            const label = sprintf(
              /* translators: %d: option number */
              __('Option %d', 'subtleforms'),
              n
            );
            commit([...options, { label, value: `option_${nanoid(6)}`, ...(withImage ? { image: '' } : {}) }]);
          }}>
          {__('Add option', 'subtleforms')}
        </Button>
      )}
    </div>
  );
}

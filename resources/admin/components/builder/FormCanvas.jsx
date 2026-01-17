import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import FieldList from './FieldList';
import { getIcon } from './utils/iconMap';
import './FormCanvas.scss';

export default function FormCanvas({
  schema,
  fields,
  selectedIndex,
  hoveredIndex,
  showFieldPicker,
  fieldPickerAnchorRef,
  onSelect,
  onHover,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onShowPicker,
}) {
  // Get canvas width from schema metadata
  const canvasWidth = schema?.metadata?.canvasWidth || 'standard';

  const canvasWidthClass =
    {
      narrow: 'sf-form-canvas__inner--narrow',
      standard: 'sf-form-canvas__inner--standard',
      wide: 'sf-form-canvas__inner--wide',
    }[canvasWidth] || 'sf-form-canvas__inner--standard';

  return (
    <div className='sf-form-canvas'>
      <div className={clsx('sf-form-canvas__inner', canvasWidthClass)}>
        {/* Form Title */}
        <div className='sf-form-canvas__header'>
          <h3 className='sf-form-canvas__title'>
            {schema?.metadata?.title || __('Untitled Form', 'subtleforms')}
          </h3>
          <p className='sf-form-canvas__description'>
            {schema?.metadata?.description ||
              __('Fill out the form below', 'subtleforms')}
          </p>
        </div>

        {/* Empty State */}
        {fields.length === 0 && (
          <div className='sf-form-canvas__empty'>
            <div className='sf-form-canvas__empty-content'>
              <button
                className='sf-form-canvas__empty-add-btn'
                onClick={() => onShowPicker([0])}
                type='button'>
                <svg
                  width='24'
                  height='24'
                  viewBox='0 0 24 24'
                  fill='none'
                  xmlns='http://www.w3.org/2000/svg'>
                  <path
                    d='M12 5v14m-7-7h14'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                  />
                </svg>
              </button>
              <div className='sf-form-canvas__empty-instruction'>
                <svg
                  className='sf-form-canvas__empty-arrow'
                  width='120'
                  height='80'
                  viewBox='0 0 120 80'
                  fill='none'
                  xmlns='http://www.w3.org/2000/svg'>
                  <path
                    d='M10 10 Q 60 -10, 80 30 T 110 70'
                    stroke='#4F9CF9'
                    strokeWidth='2'
                    fill='none'
                    strokeDasharray='4 4'
                  />
                  <path
                    d='M 105 65 L 110 70 L 105 75'
                    stroke='#4F9CF9'
                    strokeWidth='2'
                    fill='none'
                  />
                </svg>
                <p className='sf-form-canvas__empty-text'>
                  {__('Click to add your first field', 'subtleforms')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form Fields */}
        <FieldList
          fields={fields}
          parentPath={[]}
          selectedIndex={selectedIndex}
          hoveredIndex={hoveredIndex}
          showFieldPicker={showFieldPicker}
          onSelect={onSelect}
          onHover={onHover}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onShowPicker={onShowPicker}
        />
      </div>
    </div>
  );
}

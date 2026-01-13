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
            <div className='sf-form-canvas__empty-icon'>
              {(() => {
                const EmptyIcon = getIcon('default');
                return <EmptyIcon size={56} />;
              })()}
            </div>
            <h4 className='sf-form-canvas__empty-title'>
              {__('Start Building Your Form', 'subtleforms')}
            </h4>
            <p className='sf-form-canvas__empty-text'>
              {__('Add fields from the left sidebar to begin', 'subtleforms')}
            </p>
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

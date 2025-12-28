import { __ } from '@wordpress/i18n';
import classNames from 'classnames';
import FieldList from './FieldList';
import { getIcon } from './utils/iconMap';

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
      narrow: 'sf-max-w-2xl',
      standard: 'sf-max-w-3xl',
      wide: 'sf-max-w-5xl',
    }[canvasWidth] || 'sf-max-w-3xl';

  return (
    <div className='sf-flex-1 sf-bg-gray-100 sf-p-8 sf-overflow-auto'>
      <div
        className={classNames(
          'sf-bg-white sf-mx-auto sf-p-12 sf-min-h-[500px]',
          canvasWidthClass
        )}>
        {/* Form Title */}
        <div className='sf-mb-8'>
          <h3 className='sf-m-0 sf-mb-2 sf-font-semibold sf-text-gray-900 sf-text-2xl'>
            {schema?.metadata?.title || __('Untitled Form', 'subtleforms')}
          </h3>
          <p className='sf-m-0 sf-text-gray-600 sf-text-sm'>
            {schema?.metadata?.description ||
              __('Fill out the form below', 'subtleforms')}
          </p>
        </div>

        {/* Empty State */}
        {fields.length === 0 && (
          <div className='sf-px-5 sf-py-20 sf-text-gray-500 sf-text-center'>
            <div className='sf-flex sf-justify-center sf-mb-4'>
              {(() => {
                const EmptyIcon = getIcon('default');
                return <EmptyIcon size={56} />;
              })()}
            </div>
            <h4 className='sf-m-0 sf-mb-2 sf-font-semibold sf-text-gray-700 sf-text-lg'>
              {__('Start Building Your Form', 'subtleforms')}
            </h4>
            <p className='sf-m-0 sf-text-gray-500 sf-text-sm'>
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

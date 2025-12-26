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
      narrow: 'max-w-2xl',
      standard: 'max-w-3xl',
      wide: 'max-w-5xl',
    }[canvasWidth] || 'max-w-3xl';

  return (
    <div className='flex-1 bg-gray-100 p-8 overflow-auto'>
      <div
        className={classNames(
          'bg-white mx-auto p-12 min-h-[500px]',
          canvasWidthClass
        )}>
        {/* Form Title */}
        <div className='mb-8'>
          <h3 className='m-0 mb-2 font-semibold text-gray-900 text-2xl'>
            {schema?.metadata?.title || __('Untitled Form', 'subtleforms')}
          </h3>
          <p className='m-0 text-gray-600 text-sm'>
            {schema?.metadata?.description ||
              __('Fill out the form below', 'subtleforms')}
          </p>
        </div>

        {/* Empty State */}
        {fields.length === 0 && (
          <div className='px-5 py-20 text-gray-500 text-center'>
            <div className='flex justify-center mb-4'>
              {(() => {
                const EmptyIcon = getIcon('default');
                return <EmptyIcon size={56} />;
              })()}
            </div>
            <h4 className='m-0 mb-2 font-semibold text-gray-700 text-lg'>
              {__('Start Building Your Form', 'subtleforms')}
            </h4>
            <p className='m-0 text-gray-500 text-sm'>
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

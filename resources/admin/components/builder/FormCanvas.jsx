import { __ } from '@wordpress/i18n';
import { Icon } from '@wordpress/components';
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
  return (
    <div className='flex-1 overflow-auto p-8 bg-gray-100'>
      <div className='max-w-3xl mx-auto bg-white p-12 min-h-[500px]'>
        {/* Form Title */}
        <div className='mb-8'>
          <h3 className='m-0 mb-2 text-2xl font-semibold text-gray-900'>
            {schema?.metadata?.title || __('Untitled Form', 'subtleforms')}
          </h3>
          <p className='m-0 text-sm text-gray-600'>
            {schema?.metadata?.description ||
              __('Fill out the form below', 'subtleforms')}
          </p>
        </div>

        {/* Empty State */}
        {fields.length === 0 && (
          <div className='text-center py-20 px-5 text-gray-500'>
            <div className='mb-4 flex justify-center'>
              <Icon icon={getIcon('default')} size={56} />
            </div>
            <h4 className='m-0 mb-2 text-lg font-semibold text-gray-700'>
              {__('Start Building Your Form', 'subtleforms')}
            </h4>
            <p className='m-0 text-sm text-gray-500'>
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

import { __ } from '@wordpress/i18n';
import FieldWrapper from './FieldWrapper';
import ContainerWrapper from './ContainerWrapper';
import InlineAddButton from './InlineAddButton';
import './FieldList.scss';

export default function FieldList({
  fields,
  parentPath = [],
  selectedIndex,
  hoveredIndex,
  showFieldPicker,
  onSelect,
  onHover,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onShowPicker,
}) {
  const isPathEqual = (a, b) => {
    if (!a || !b) return false;
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.length === b.length && a.every((v, i) => v === b[i]);
    }
    return a === b;
  };

  return (
    <>
      {fields.map((field, i) => {
        const currentPath = [...parentPath, i];
        const isContainer =
          field.type.endsWith('_container') || field.type === 'repeat_field';
        const isSelected = isPathEqual(selectedIndex, currentPath);
        const isHovered = isPathEqual(hoveredIndex, currentPath);

        return (
          <div key={field.id || i} className='sf-mb-4'>
            {/* Add Button Before */}
            <div className='sf-field-list__add-button-zone'>
              <InlineAddButton
                index={i}
                isHovered={isHovered}
                showFieldPicker={
                  showFieldPicker &&
                  isPathEqual(showFieldPicker.position, currentPath)
                }
                onHover={() => {}}
                onLeave={() => {}}
                onClick={() => onShowPicker(currentPath)}
                anchorRef={null}
              />
            </div>

            {isContainer ? (
              <ContainerWrapper
                field={field}
                path={currentPath}
                isSelected={isSelected}
                isHovered={isHovered}
                onSelect={onSelect}
                onHover={onHover}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                onDuplicate={onDuplicate}
                onDelete={onDelete}>
                <FieldList
                  fields={field.fields || []}
                  parentPath={currentPath}
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
                {/* Add Button Inside Container (at end) */}
                <div className='sf-field-list__container-add-button'>
                  <InlineAddButton
                    index={(field.fields || []).length}
                    isHovered={true}
                    showFieldPicker={
                      showFieldPicker &&
                      isPathEqual(showFieldPicker.position, [
                        ...currentPath,
                        (field.fields || []).length,
                      ])
                    }
                    onHover={() => {}}
                    onLeave={() => {}}
                    onClick={() =>
                      onShowPicker([
                        ...currentPath,
                        (field.fields || []).length,
                      ])
                    }
                    anchorRef={null}
                    label={__('Add Field', 'subtleforms')}
                  />
                </div>
              </ContainerWrapper>
            ) : (
              <FieldWrapper
                field={field}
                index={i}
                isSelected={isSelected}
                isHovered={isHovered}
                isFirst={i === 0}
                isLast={i === fields.length - 1}
                onSelect={() => onSelect(currentPath)}
                onHover={() => onHover(currentPath)}
                onLeave={() => onHover(null)}
                onMoveUp={() => onMoveUp(currentPath)}
                onMoveDown={() => onMoveDown(currentPath)}
                onDuplicate={() => onDuplicate(currentPath)}
                onDelete={() => onDelete(currentPath)}
              />
            )}
          </div>
        );
      })}

      {/* Add Button at the end of the list */}
      <div className='sf-field-list__add-button-container'>
        <InlineAddButton
          index={fields.length}
          isHovered={true}
          showFieldPicker={
            showFieldPicker &&
            isPathEqual(showFieldPicker.position, [
              ...parentPath,
              fields.length,
            ])
          }
          onHover={() => {}}
          onLeave={() => {}}
          onClick={() => onShowPicker([...parentPath, fields.length])}
          anchorRef={null}
          label={__('Add Field', 'subtleforms')}
        />
      </div>
    </>
  );
}

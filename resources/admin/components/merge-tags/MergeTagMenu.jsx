import { DropdownMenu, MenuGroup, MenuItem } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import Icon from '../../ui/Icon';
import { GLOBAL_MERGE_TAGS, fieldMergeTags } from './mergeTags';

/**
 * "Insert tag" menu for an email setting.
 *
 * @param {Object}   props
 * @param {Array}    props.fields   Form fields ({ key, label, type }).
 * @param {Function} props.onInsert Called with the tag text.
 * @param {boolean}  props.disabled Read-only builder.
 * @param {boolean}  props.allowAll Offer {all_fields} (body only).
 * @param {string}   props.target   What the tag is inserted into, for the label.
 */
export default function MergeTagMenu({ fields = [], onInsert, disabled = false, allowAll = true, target = '' }) {
  const globals = GLOBAL_MERGE_TAGS.filter((t) => allowAll || t.tag !== '{all_fields}');
  const fieldTags = fieldMergeTags(fields);
  return (
    <DropdownMenu
      className='sf-merge-tag-menu'
      icon={<Icon.Plus size={14} />}
      label={
        target
          ? sprintf(
              /* translators: %s: setting name, e.g. Subject */
              __('Insert tag into %s', 'subtleforms'),
              target
            )
          : __('Insert tag', 'subtleforms')
      }
      text={__('Insert tag', 'subtleforms')}
      toggleProps={{ size: 'small', variant: 'tertiary', disabled }}
      popoverProps={{ placement: 'bottom-end' }}>
      {({ onClose }) => (
        <>
          <MenuGroup label={__('Entry', 'subtleforms')}>
            {globals.map((t) => (
              <MenuItem
                key={t.tag}
                info={t.tag}
                onClick={() => {
                  onInsert(t.tag);
                  onClose();
                }}>
                {t.label}
              </MenuItem>
            ))}
          </MenuGroup>
          {fieldTags.length > 0 && (
            <MenuGroup label={__('Fields', 'subtleforms')}>
              {fieldTags.map((t) => (
                <MenuItem
                  key={t.tag}
                  info={t.tag}
                  onClick={() => {
                    onInsert(t.tag);
                    onClose();
                  }}>
                  {t.label}
                </MenuItem>
              ))}
            </MenuGroup>
          )}
        </>
      )}
    </DropdownMenu>
  );
}

/**
 * Rules section: what a visitor's answer must satisfy. The two messages come
 * first ("If empty", "If invalid"), then every rule the field type supports
 * (length, range, pattern, selections). Required itself is a quick row at the
 * top of the panel, with Width and Visibility.
 */

import { __ } from '@wordpress/i18n';
import DynamicInspectorPanel from '../DynamicInspectorPanel';
import './ValidationPanel.scss';

/** The two messages, in the order they are drawn, with their short names. */
const MESSAGE_ROWS = {
  requiredMessage: { label: __('If empty', 'subtleforms') },
  validationMessage: {
    label: __('If invalid', 'subtleforms'),
    placeholder: __('Standard message', 'subtleforms'),
  },
};

const isMessage = (ctrl) => Object.prototype.hasOwnProperty.call(MESSAGE_ROWS, ctrl.key ?? ctrl.name);
const isRule = (ctrl) => ctrl.section === 'validation' && !isMessage(ctrl);
const isMessageRow = (ctrl) => ctrl.section === 'validation' && isMessage(ctrl);

export default function ValidationPanel({ field, onUpdate, isReadOnly }) {
  return (
    <div className='sf-validation-panel'>
      <DynamicInspectorPanel
        field={field}
        onUpdate={onUpdate}
        isReadOnly={isReadOnly}
        pick={isMessageRow}
        overrides={MESSAGE_ROWS}
        showEmpty={false}
      />
      <DynamicInspectorPanel
        field={field}
        onUpdate={onUpdate}
        isReadOnly={isReadOnly}
        pick={isRule}
        showEmpty={false}
      />
    </div>
  );
}

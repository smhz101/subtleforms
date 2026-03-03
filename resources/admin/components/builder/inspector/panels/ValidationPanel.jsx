/**
 * ValidationPanel.jsx
 * 
 * Validation settings: required field checkbox
 */

import { CheckboxControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

export default function ValidationPanel({ field, onUpdate, isReadOnly }) {
  return (
    <CheckboxControl
      label={__('Required Field', 'subtleforms')}
      checked={!!field.required}
      onChange={(checked) => onUpdate({ required: checked })}
      disabled={isReadOnly}
      help={__('User must fill this field to submit', 'subtleforms')}
    />
  );
}

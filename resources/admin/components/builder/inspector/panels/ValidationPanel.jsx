/**
 * ValidationPanel.jsx
 * 
 * Validation settings: required field checkbox
 */

import { CheckboxControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import './ValidationPanel.scss';

export default function ValidationPanel({ field, onUpdate, isReadOnly }) {
  return (
    <div className='sf-validation-panel'>

      {/* Required */}
      <div className='sf-validation-panel__section'>
        <p className='sf-validation-panel__section-label'>
          {__('Required', 'subtleforms')}
        </p>
        <CheckboxControl
          label={__('This field is required', 'subtleforms')}
          checked={!!field.required}
          onChange={(checked) => onUpdate({ required: checked })}
          disabled={isReadOnly}
          help={__("The form won't submit unless this field is filled in.", 'subtleforms')}
        />
      </div>

      {/* Validation Rules */}
      <div className='sf-validation-panel__section'>
        <p className='sf-validation-panel__section-label'>
          {__('Validation Rules', 'subtleforms')}
        </p>
        <p className='sf-validation-panel__note'>
          {__('Rules like Min, Max, and Max Length are configured in the General tab.', 'subtleforms')}
        </p>
      </div>

      {/* Error Messages */}
      <div className='sf-validation-panel__section sf-validation-panel__section--muted'>
        <p className='sf-validation-panel__section-label'>
          {__('Error Messages', 'subtleforms')}
        </p>
        <p className='sf-validation-panel__note'>
          {__('Custom error messages will be configurable in a future update.', 'subtleforms')}
        </p>
      </div>

    </div>
  );
}

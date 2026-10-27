/**
 * Validation tab: required + every rule the field type supports
 * (length, range, pattern, selections, custom messages).
 */

import { ToggleControl } from '@wordpress/components';
import { typeHasFlag } from '../../../../utils/fieldTypeFlags';
import { __ } from '@wordpress/i18n';
import DynamicInspectorPanel from '../DynamicInspectorPanel';
import './ValidationPanel.scss';

const NO_REQUIRED = new Set(['calculation', 'hidden', 'html']);

export default function ValidationPanel({ field, onUpdate, isReadOnly }) {
  return (
    <div className='sf-validation-panel'>
      {!NO_REQUIRED.has(field.type) && !typeHasFlag(field.type, 'noMessages') && (
        <div className='sf-validation-panel__required'>
          <ToggleControl
            __nextHasNoMarginBottom
            label={__('Required', 'subtleforms')}
            help={
              field.required
                ? __('Visitors must answer before the form can be sent.', 'subtleforms')
                : __('Visitors can leave this empty.', 'subtleforms')
            }
            checked={!!field.required}
            onChange={(checked) => onUpdate({ required: checked })}
            disabled={isReadOnly}
          />
        </div>
      )}

      <DynamicInspectorPanel
        field={field}
        onUpdate={onUpdate}
        isReadOnly={isReadOnly}
        sections={['validation']}
        showEmpty={false}
      />
    </div>
  );
}

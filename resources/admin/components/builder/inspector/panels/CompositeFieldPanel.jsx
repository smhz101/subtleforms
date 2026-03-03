/**
 * CompositeFieldPanel.jsx
 * 
 * Settings for composite fields: name_group, address_group
 */

import { ToggleControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { PanelSection } from '../../../ui';

export default function CompositeFieldPanel({ field, onUpdate, isReadOnly }) {
  if (field.type === 'name_group') {
    return (
      <PanelSection
        title={__('Name Parts', 'subtleforms')}
        initialOpen={false}>
        <ToggleControl
          label={__('First Name', 'subtleforms')}
          checked={field.enable_first_name !== false}
          onChange={(v) => onUpdate({ enable_first_name: v })}
          disabled={isReadOnly}
        />
        <ToggleControl
          label={__('Middle Name', 'subtleforms')}
          checked={!!field.enable_middle_name}
          onChange={(v) => onUpdate({ enable_middle_name: v })}
          disabled={isReadOnly}
        />
        <ToggleControl
          label={__('Last Name', 'subtleforms')}
          checked={field.enable_last_name !== false}
          onChange={(v) => onUpdate({ enable_last_name: v })}
          disabled={isReadOnly}
        />
      </PanelSection>
    );
  }

  if (field.type === 'address_group') {
    return (
      <PanelSection
        title={__('Address Parts', 'subtleforms')}
        initialOpen={false}>
        <ToggleControl
          label={__('Street Address', 'subtleforms')}
          checked={field.enable_street1 !== false}
          onChange={(v) => onUpdate({ enable_street1: v })}
          disabled={isReadOnly}
        />
        <ToggleControl
          label={__('Street Address Line 2', 'subtleforms')}
          checked={field.enable_street2 !== false}
          onChange={(v) => onUpdate({ enable_street2: v })}
          disabled={isReadOnly}
        />
        <ToggleControl
          label={__('City', 'subtleforms')}
          checked={field.enable_city !== false}
          onChange={(v) => onUpdate({ enable_city: v })}
          disabled={isReadOnly}
        />
        <ToggleControl
          label={__('State / Province', 'subtleforms')}
          checked={field.enable_state !== false}
          onChange={(v) => onUpdate({ enable_state: v })}
          disabled={isReadOnly}
        />
        <ToggleControl
          label={__('Postal Code', 'subtleforms')}
          checked={field.enable_postal_code !== false}
          onChange={(v) => onUpdate({ enable_postal_code: v })}
          disabled={isReadOnly}
        />
        <ToggleControl
          label={__('Country', 'subtleforms')}
          checked={field.enable_country !== false}
          onChange={(v) => onUpdate({ enable_country: v })}
          disabled={isReadOnly}
        />
      </PanelSection>
    );
  }

  return null;
}

/**
 * GeneralSettingsPanel.jsx
 * 
 * General field settings: label, placeholder, field key
 */

import { TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { PanelSection } from '../../../ui';

export default function GeneralSettingsPanel({ field, onUpdate, isReadOnly }) {
  if (field.type === 'step') {
    return (
      <>
        <TextControl
          label={__('Step Title', 'subtleforms')}
          value={field.title || ''}
          onChange={(v) => onUpdate({ title: v })}
          disabled={isReadOnly}
          help={__('Title shown in step navigation', 'subtleforms')}
        />
        <TextControl
          label={__('Description', 'subtleforms')}
          value={field.description || ''}
          onChange={(v) => onUpdate({ description: v })}
          disabled={isReadOnly}
          help={__('Optional description for this step', 'subtleforms')}
        />
      </>
    );
  }

  if (
    field.type.endsWith('_column_container') ||
    field.type === 'repeat_container' ||
    field.type === 'group_container'
  ) {
    return (
      <>
        {field.type.endsWith('_column_container') && (
          <TextControl
            label={__('Columns', 'subtleforms')}
            value={field.columns}
            readOnly
            help={__('Number of columns', 'subtleforms')}
          />
        )}
        {field.type === 'repeat_container' && (
          <PanelSection
            title={__('Repeater Settings', 'subtleforms')}
            initialOpen={true}>
            <TextControl
              label={__('Button Label', 'subtleforms')}
              value={field.buttonLabel || ''}
              onChange={(v) => onUpdate({ buttonLabel: v })}
              disabled={isReadOnly}
            />
            <TextControl
              label={__('Min Repeats', 'subtleforms')}
              type='number'
              value={field.min || 1}
              onChange={(v) => onUpdate({ min: parseInt(v, 10) })}
              disabled={isReadOnly}
            />
            <TextControl
              label={__('Max Repeats', 'subtleforms')}
              type='number'
              value={field.max || 5}
              onChange={(v) => onUpdate({ max: parseInt(v, 10) })}
              disabled={isReadOnly}
            />
          </PanelSection>
        )}
        <PanelSection
          title={__('Layout', 'subtleforms')}
          initialOpen={false}
          variant='subtle'>
          <TextControl
            label={__('Spacing (px)', 'subtleforms')}
            type='number'
            value={field.spacing ?? ''}
            onChange={(v) => {
              const next = parseInt(v, 10);
              onUpdate({ spacing: Number.isNaN(next) ? 0 : next });
            }}
            disabled={isReadOnly}
          />
        </PanelSection>
      </>
    );
  }

  // Regular fields
  return (
    <>
      <TextControl
        label={__('Field Label', 'subtleforms')}
        value={field.label || ''}
        onChange={(v) => onUpdate({ label: v })}
        disabled={isReadOnly}
        help={__('The label displayed above the field', 'subtleforms')}
      />
      <TextControl
        label={__('Placeholder Text', 'subtleforms')}
        value={field.placeholder || ''}
        onChange={(v) => onUpdate({ placeholder: v })}
        disabled={isReadOnly}
        help={__('Hint text shown inside the field', 'subtleforms')}
      />

      <PanelSection
        title={__('Advanced', 'subtleforms')}
        initialOpen={false}
        variant='subtle'>
        <TextControl
          label={__('Field Key', 'subtleforms')}
          value={field.key || ''}
          disabled
          help={__('Unique identifier for data mapping', 'subtleforms')}
        />
      </PanelSection>
    </>
  );
}

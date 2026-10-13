import { Button, TabPanel, Notice, PanelBody, SelectControl } from '@wordpress/components';
import { useMemo, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import Icon from '../../ui/Icon';
import LogicEditor, { readLogic, countRules } from './LogicEditor';
import { isProFeature } from '../../utils/featureGate';
import { useBuilder } from './context/BuilderContext';
import { useConfig } from './context/ConfigContext';
import {
  OptionsPanel,
  ValidationPanel,
  DynamicInspectorPanel,
} from './inspector/panels';
import { CHOICE_TYPES } from './inspector/panels/OptionsPanel';
import FieldAppearancePanel from './appearance/FieldAppearancePanel';
import { supportsAppearance } from '../../../shared/appearance';
import { getIcon } from './utils/iconMap';
import { stepOptions, getStepIdOf } from './schema/commands/steps';

/**
 * "Step" setting for fields of a multi-step form (2.3.1): moving a field to
 * another step keeps its key, settings, logic and payment links, puts it at
 * the end of that step and switches the canvas there.
 */
function StepSetting({ tree, nodeId, onMoveToStep, isReadOnly }) {
  const options = stepOptions(tree);
  const node = tree.nodes[nodeId];
  if (!node || node.type === 'step' || options.length === 0) {
    return null;
  }
  const currentStep = getStepIdOf(tree, nodeId);
  const nested = node.parentId && tree.nodes[node.parentId]?.type !== 'step';
  return (
    <div className='sf-field-inspector__step-setting'>
      <SelectControl
        __nextHasNoMarginBottom
        __next40pxDefaultSize
        label={__('Step', 'subtleforms')}
        value={currentStep || ''}
        options={options}
        disabled={isReadOnly || !onMoveToStep}
        help={
          nested
            ? __('Moving it takes the field out of its container and puts it at the end of the chosen step.', 'subtleforms')
            : __('Moves the field to the end of the chosen step.', 'subtleforms')
        }
        onChange={(stepId) => {
          if (stepId && stepId !== currentStep) {
            onMoveToStep(nodeId, stepId);
          }
        }}
      />
    </div>
  );
}

/**
 * Field inspector — the right panel of the builder.
 *
 * Header: what the field is and its key (copyable, used in formulas, emails
 * and webhooks), with duplicate and delete. Body: four tabs — Settings,
 * Validation, Logic and Style — each made of collapsible panels like the
 * block editor's sidebar.
 */
export default function FieldInspector({ field, allFields, formAppearance, isReadOnly = false }) {
  const { setSelectedId, actions, validationErrors, selectedId, tree } = useBuilder();
  const { fieldDefinitions } = useConfig();
  const [copied, setCopied] = useState(false);

  const definition = fieldDefinitions?.[field?.type];
  const fieldCategory = definition?.meta?.category;
  // Content blocks (HTML, Notice, Section Heading) and hidden values take no
  // answer from the visitor: no Validation tab (2.3.2).
  const isContentBlock = ['html', 'section_break', 'disclaimer'].includes(field?.type);
  const isInputLike =
    (!fieldCategory || fieldCategory === 'regular' || fieldCategory === 'composite') &&
    !isContentBlock &&
    field?.type !== 'hidden' &&
    definition?.kind !== 'structure';

  const validationMessages = selectedId
    ? (validationErrors || [])
        .filter((v) => v.fieldKey === field?.key)
        .map((v) => v.message)
    : [];

  const handleUpdate = (changes) => {
    if (!selectedId || isReadOnly) return;
    actions.onUpdate(selectedId, changes);
  };

  const fieldWarnings = useMemo(() => {
    if (!field) return [];
    const warnings = [];
    if (field.required && !field.label?.trim()) {
      warnings.push(
        __('This required field has no label, so visitors won’t know what to enter.', 'subtleforms')
      );
    }
    if (CHOICE_TYPES.includes(field.type) && (!field.options || field.options.length === 0)) {
      warnings.push(__('Add at least one option.', 'subtleforms'));
    }
    if (field.type === 'calculation' && !field.formula?.trim()) {
      warnings.push(__('Add a formula to show a result.', 'subtleforms'));
    }
    return warnings;
  }, [field]);

  if (!field) {
    return (
      <div className='sf-field-inspector'>
        <div className='sf-field-inspector__empty'>
          <span className='sf-field-inspector__empty-icon' aria-hidden='true'>
            <Icon.Sliders size={20} />
          </span>
          <p className='sf-field-inspector__empty-title'>
            {__('No field selected', 'subtleforms')}
          </p>
          <p className='sf-field-inspector__empty-text'>
            {__(
              'Select a field on the canvas to edit its label, options, validation and logic.',
              'subtleforms'
            )}
          </p>
          <ul className='sf-field-inspector__shortcuts'>
            <li>
              <kbd>/</kbd> {__('Search fields', 'subtleforms')}
            </li>
            <li>
              <kbd>Ctrl</kbd>
              <kbd>Z</kbd> {__('Undo', 'subtleforms')}
            </li>
            <li>
              <kbd>Del</kbd> {__('Delete selected field', 'subtleforms')}
            </li>
          </ul>
        </div>
      </div>
    );
  }

  const isStep = field.type === 'step';
  const fieldLogic = readLogic(field);
  const ruleCount = countRules(fieldLogic);
  const logicTab = {
    name: 'logic',
    title: (
      <span className='sf-field-inspector__tab-label'>
        {__('Logic', 'subtleforms')}
        {ruleCount > 0 && (
          <span className='sf-field-inspector__tab-count'>{ruleCount}</span>
        )}
      </span>
    ),
  };

  const FieldIcon = getIcon(field.type);
  const typeLabel = definition?.label || field.type?.replace(/_/g, ' ');
  const fieldKey = field.key;

  const tabs = [
    { name: 'settings', title: __('Settings', 'subtleforms') },
    ...(isInputLike
      ? [
          {
            name: 'validation',
            title: (
              <span className='sf-field-inspector__tab-label'>
                {__('Validation', 'subtleforms')}
                {validationMessages.length > 0 && (
                  <span className='sf-field-inspector__tab-dot' aria-hidden='true' />
                )}
              </span>
            ),
          },
          logicTab,
        ]
      : isStep || isContentBlock
      ? [logicTab]
      : []),
    ...(supportsAppearance(field.type)
      ? [{ name: 'style', title: __('Style', 'subtleforms') }]
      : []),
  ];

  return (
    <div className='sf-field-inspector'>
      <div className='sf-field-inspector__header'>
        <span className='sf-field-inspector__type-icon' aria-hidden='true'>
          <FieldIcon size={20} />
        </span>
        <div className='sf-field-inspector__header-info'>
          <strong className='sf-field-inspector__title'>{typeLabel}</strong>
          {fieldKey && (
            <button
              type='button'
              className='sf-field-inspector__key'
              title={__('Copy field key', 'subtleforms')}
              onClick={() => {
                window.navigator?.clipboard?.writeText(`{${fieldKey}}`).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}>
              {copied ? (
                <>
                  <Icon.Check size={12} /> {__('Copied', 'subtleforms')}
                </>
              ) : (
                <>
                  <code>{fieldKey}</code>
                  <Icon.Copy size={12} />
                </>
              )}
            </button>
          )}
        </div>
        <div className='sf-field-inspector__header-actions'>
          <Button
            size='compact'
            icon={<Icon.Copy size={16} />}
            label={__('Duplicate', 'subtleforms')}
            showTooltip
            disabled={isReadOnly}
            onClick={() => actions.onDuplicate?.(selectedId)}
          />
          <Button
            size='compact'
            isDestructive
            icon={<Icon.Trash size={16} />}
            label={__('Delete', 'subtleforms')}
            showTooltip
            disabled={isReadOnly}
            onClick={() => actions.onDelete?.(selectedId)}
          />
          <Button
            size='compact'
            icon={<Icon.Close size={16} />}
            label={__('Close settings', 'subtleforms')}
            showTooltip
            onClick={() => setSelectedId(null)}
          />
        </div>
      </div>

      {(isReadOnly || validationMessages.length > 0 || fieldWarnings.length > 0) && (
        <div className='sf-field-inspector__notices'>
          {isReadOnly && (
            <Notice status='info' isDismissible={false}>
              {__('Read-only: this form uses Pro features. Activate your license to edit it. The live form keeps working.', 'subtleforms')}
            </Notice>
          )}
          {validationMessages.slice(0, 1).map((m, i) => (
            <Notice key={`v${i}`} status='warning' isDismissible={false}>
              {m}
            </Notice>
          ))}
          {fieldWarnings.map((warning, i) => (
            <Notice key={`w${i}`} status='warning' isDismissible={false}>
              {warning}
            </Notice>
          ))}
        </div>
      )}

      <TabPanel
        key={field.id ?? 'none'}
        className='sf-field-inspector__tabs'
        tabs={tabs}>
        {(tab) => (
          <div className='sf-field-inspector__tab-content'>
            {tab.name === 'settings' && (
              <>
                <PanelBody title={__('General', 'subtleforms')} initialOpen>
                  <StepSetting
                    tree={tree}
                    nodeId={selectedId}
                    onMoveToStep={actions.onMoveToStep}
                    isReadOnly={isReadOnly}
                  />
                  <DynamicInspectorPanel
                    field={field}
                    onUpdate={handleUpdate}
                    isReadOnly={isReadOnly}
                    sections={['general']}
                  />
                </PanelBody>
                <AppearancePanel
                  field={field}
                  onUpdate={handleUpdate}
                  isReadOnly={isReadOnly}
                />
                {CHOICE_TYPES.includes(field.type) && (
                  <PanelBody title={__('Choices', 'subtleforms')} initialOpen>
                    <OptionsPanel
                      field={field}
                      onUpdate={handleUpdate}
                      isReadOnly={isReadOnly}
                    />
                  </PanelBody>
                )}
                <AdvancedPanel
                  field={field}
                  onUpdate={handleUpdate}
                  isReadOnly={isReadOnly}
                />
              </>
            )}
            {tab.name === 'validation' && (
              <div className='sf-field-inspector__pad'>
                <ValidationPanel
                  field={field}
                  onUpdate={handleUpdate}
                  isReadOnly={isReadOnly}
                />
              </div>
            )}
            {tab.name === 'logic' && (
              <div className='sf-field-inspector__pad'>
                <p className='sf-field-inspector__intro'>
                  {isStep
                    ? __('Skip this step unless its rules match. Fields in a skipped step are not checked or saved.', 'subtleforms')
                    : sprintf(
                        /* translators: %s: field label */
                        __('Show or hide “%s” based on answers to other fields. Hidden fields are not checked or saved.', 'subtleforms'),
                        field.label || typeLabel
                      )}
                </p>
                <LogicEditor
                  logic={fieldLogic}
                  availableFields={(allFields || []).filter((f) => f.key !== field.key)}
                  locked={isStep && !isProFeature('logic.conditional.advanced')}
                  disabled={isReadOnly}
                  emptyText={
                    isStep
                      ? __('This step is always shown.', 'subtleforms')
                      : undefined
                  }
                  onChange={(logic) => handleUpdate({ logic, conditions: [] })}
                />
              </div>
            )}
            {tab.name === 'style' && (
              <div className='sf-field-inspector__pad sf-field-inspector__pad--style'>
                <FieldAppearancePanel
                  field={field}
                  onUpdate={handleUpdate}
                  formAppearance={formAppearance}
                  isReadOnly={isReadOnly}
                />
              </div>
            )}
          </div>
        )}
      </TabPanel>
    </div>
  );
}

/**
 * Appearance panel — only rendered when the field type has appearance settings.
 */
function AppearancePanel({ field, onUpdate, isReadOnly }) {
  const { fieldDefinitions } = useConfig();
  const def = fieldDefinitions?.[field.type];
  const all = [
    ...(Array.isArray(def?.inspectorControls) ? def.inspectorControls : []),
    ...(Array.isArray(def?.layoutControls) ? def.layoutControls : []),
  ];
  if (!all.some((c) => c?.section === 'appearance')) {
    return null;
  }
  return (
    <PanelBody title={__('Appearance', 'subtleforms')} initialOpen={false}>
      <DynamicInspectorPanel
        field={field}
        onUpdate={onUpdate}
        isReadOnly={isReadOnly}
        sections={['appearance']}
        showEmpty={false}
      />
    </PanelBody>
  );
}

/**
 * Advanced panel — only rendered when the field type has advanced settings.
 */
function AdvancedPanel({ field, onUpdate, isReadOnly }) {
  const { fieldDefinitions } = useConfig();
  const def = fieldDefinitions?.[field.type];
  const all = [
    ...(Array.isArray(def?.inspectorControls) ? def.inspectorControls : []),
    ...(Array.isArray(def?.layoutControls) ? def.layoutControls : []),
  ];
  if (!all.some((c) => c?.section === 'advanced')) {
    return null;
  }
  return (
    <PanelBody title={__('Advanced', 'subtleforms')} initialOpen={false}>
      <DynamicInspectorPanel
        field={field}
        onUpdate={onUpdate}
        isReadOnly={isReadOnly}
        sections={['advanced']}
        showEmpty={false}
      />
    </PanelBody>
  );
}

import { Button, Notice } from '@wordpress/components';
import { useEffect, useId, useMemo, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import Icon from '../../ui/Icon';
import LogicEditor, { readLogic, countRules } from './LogicEditor';
import { getLogicEditor } from '../../../shared/extend';
import ChainedLevelsControl from './inspector/controls/ChainedLevelsControl';
import ChainedDisplayControl from './inspector/controls/ChainedDisplayControl';
import ChainedSourceControl from './inspector/controls/ChainedSourceControl';
import ChainedCsvControl from './inspector/controls/ChainedCsvControl';
import ToggleInspectorControl from './inspector/controls/ToggleInspectorControl';
import Segmented from './inspector/controls/Segmented';
import ChipSelect from './inspector/controls/ChipSelect';
import PropertyRow, { useRowIds } from './inspector/PropertyRow';
import InspectorSection, { useSectionOpen } from './inspector/InspectorSection';
import InspectorTabs, { useInspectorTab } from './inspector/InspectorTabs';
import { AsteriskGlyph, ArrowsHorizontalGlyph, EyeGlyph } from './inspector/glyphs';
import { chainedUsesCsv } from '../../../shared/chainedLevels';
import { useBuilder } from './context/BuilderContext';
import FieldKeyEditor from './FieldKeyEditor';
import { namespaceKeys } from '../../../shared/fieldKeys';
import { denormalizeTree } from './utils/schemaTree';
import { useConfig } from './context/ConfigContext';
import {
  OptionsPanel,
  ValidationPanel,
  DynamicInspectorPanel,
} from './inspector/panels';
import { isChoiceType } from './inspector/panels/OptionsPanel';
import { chainedNotSetUpWarning } from './utils/fieldWarnings';
import {
  blockPicker,
  hasControls,
  styleGroupPicker,
  isLogicOnlyType,
  resolveControls,
} from './inspector/controlSections';
import FieldAppearancePanel, { FRACTIONS, nextAppearance } from './appearance/FieldAppearancePanel';
import { FIELD_LAYOUT, supportsAppearance } from '../../../shared/appearance';
import { optionLabel } from './appearance/labels';
import { typeHasFlag } from '../../utils/fieldTypeFlags';
import { getIcon } from './utils/iconMap';
import { stepOptions, getStepIdOf } from './schema/commands/steps';
import './FieldInspector.scss';

/** Types that take no answer, so there is nothing to require. */
const NO_REQUIRED = new Set(['calculation', 'hidden', 'html']);

/** The groups of the Styles tab, in order (see styleGroup()). */
const styleGroups = () => [
  { id: 'label', title: __('Label', 'subtleforms') },
  { id: 'help', title: __('Help text', 'subtleforms') },
  { id: 'layout', title: __('Layout', 'subtleforms') },
  { id: 'input', title: __('Input', 'subtleforms') },
];

/**
 * "Step" setting for fields of a multi-step form (2.3.1): moving a field to
 * another step keeps its key, settings, logic and other links, puts it at
 * the end of that step and switches the canvas there.
 */
function StepSetting({ tree, nodeId, onMoveToStep, isReadOnly }) {
  const ids = useRowIds();
  const options = tree ? stepOptions(tree) : [];
  const node = tree?.nodes?.[nodeId];
  if (!node || node.type === 'step' || options.length === 0) {
    return null;
  }
  const currentStep = getStepIdOf(tree, nodeId);
  const nested = node.parentId && tree.nodes[node.parentId]?.type !== 'step';
  const help = nested
    ? __('Moving it takes the field out of its container and puts it at the end of the chosen step.', 'subtleforms')
    : __('Moves the field to the end of the chosen step.', 'subtleforms');
  return (
    <PropertyRow label={__('Step', 'subtleforms')} ids={ids} help={help}>
      <ChipSelect
        id={ids.id}
        options={options}
        value={currentStep || ''}
        helpId={ids.helpId}
        disabled={isReadOnly || !onMoveToStep}
        onChange={(stepId) => {
          if (stepId && stepId !== currentStep) {
            onMoveToStep(nodeId, stepId);
          }
        }}
      />
    </PropertyRow>
  );
}

/** Whether the Step setting is drawn for a node: a multi-step form, and not a step itself. */
function showsStepSetting(tree, nodeId) {
  const node = tree?.nodes?.[nodeId];
  return !!node && node.type !== 'step' && stepOptions(tree).length > 0;
}

/**
 * Width as a row of equal squares, like the heading level picker in core:
 * Auto, Full, 3/4, 2/3, 1/2, 1/3 and 1/4, the selected one bordered and bold.
 * All seven fit in the 320px panel because the squares sit under the label.
 */
function WidthRow({ field, onUpdate, isReadOnly }) {
  const ids = useRowIds();
  const appearance = field?.appearance || field?.config?.appearance || {};
  const options = [
    { value: '', label: __('Auto', 'subtleforms') },
    ...FIELD_LAYOUT.widths.map((w) => ({
      value: w.value,
      label: FRACTIONS[w.value] ?? w.label,
      title: optionLabel(w.value, w.label),
    })),
  ];
  return (
    <PropertyRow
      label={__('Width', 'subtleforms')}
      ids={ids}
      composite
      stacked
      className='sf-prow--quick'
      icon={<ArrowsHorizontalGlyph />}
      help={__('Narrower fields sit side by side and stack on phones.', 'subtleforms')}>
      <Segmented
        className='sf-seg--fill'
        options={options}
        value={appearance.width ?? ''}
        labelId={ids.labelId}
        disabled={isReadOnly}
        onChange={(value) => onUpdate({ appearance: nextAppearance(appearance, 'width', value) })}
      />
    </PropertyRow>
  );
}

/** Visibility: whether a show or hide rule applies. Opens the Logic section. */
function VisibilityRow({ hasRules, onOpen }) {
  const ids = useRowIds();
  return (
    <PropertyRow label={__('Visibility', 'subtleforms')} ids={ids} icon={<EyeGlyph />}>
      <button type='button' id={ids.id} className='sf-chip' onClick={onOpen}>
        {hasRules ? __('Rule-based', 'subtleforms') : __('Shown', 'subtleforms')}
      </button>
    </PropertyRow>
  );
}

/**
 * Field inspector, the right panel of the builder.
 *
 * One scrolling sheet. Header: what the field is, its key (copyable, used in
 * formulas, emails and webhooks) and rename, with duplicate, delete and
 * close. Under it the quick rows (Required, Width, Visibility), then the
 * sections Content, the type's own (Choices, Sub-fields, ...), Rules, Logic,
 * Style and Advanced, then a footer with the keyboard shortcuts that work.
 * A section with nothing in it for this field type is not drawn.
 */
export default function FieldInspector({ field, allFields, formAppearance, isReadOnly = false }) {
  const { setSelectedId, actions, validationErrors, selectedId, tree } = useBuilder();
  const { fieldDefinitions, entryCount = 0 } = useConfig();

  const rootRef = useRef(null);
  const [bulk, setBulk] = useState(false);
  const [pending, setPending] = useState(null);
  const choicesState = useSectionOpen('choices', false);
  const logicState = useSectionOpen('logic', false);
  const logicOpen = logicState[0];
  const [savedTab, setTab] = useInspectorTab();
  const tabBase = `sf-itab-${useId().replace(/:/g, '')}`;

  const definition = fieldDefinitions?.[field?.type];
  const fieldCategory = definition?.meta?.category;
  const isLayout = fieldCategory === 'layout';
  // Content blocks (HTML, Notice, Section Heading) and hidden values take no
  // answer from the visitor: no Rules section and no quick rows (2.3.2).
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
    if (isChoiceType(field.type) && (!field.options || field.options.length === 0)) {
      warnings.push(__('Add at least one option.', 'subtleforms'));
    }
    const chained = chainedNotSetUpWarning(field);
    if (chained) warnings.push(chained);
    return warnings;
  }, [field]);

  // Which block of the sheet draws which control (see controlBlock()).
  const pickers = useMemo(
    () => ({
      content: blockPicker('content', isLayout),
      subfields: blockPicker('subfields', isLayout),
      type: blockPicker('type', isLayout),
      advanced: blockPicker('advanced', isLayout),
    }),
    [isLayout]
  );

  // A header action or a quick row asks for a part of the sheet: once the
  // section is open and drawn, reach it.
  useEffect(() => {
    if (!pending) return;
    const root = rootRef.current;
    const section = root?.querySelector(`[data-section="${pending.section}"]`);
    if (!section) return;
    if (pending.section === 'logic' && !logicOpen) return;
    setPending(null);
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 'auto' : 'smooth';
    section.scrollIntoView?.({ block: 'nearest', behavior: motion });
    if (pending.add) {
      // The Logic editor adds a rule with its own button, found by a stable
      // attribute so a translated label does not matter.
      const add = section.querySelector('.sf-isec__body [data-sf-action="add-rule"]');
      if (add) {
        add.click();
        return;
      }
    }
    (section.querySelector('.sf-isec__body button, .sf-isec__body select, .sf-isec__body input') ||
      section.querySelector('.sf-isec__toggle'))?.focus?.();
  }, [pending, logicOpen, savedTab]);

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
  // Repeater is a layout container, so it is not "input-like", but visitors
  // still need to show or hide the whole block from another answer.
  const isRepeater = field.type === 'repeat_container';
  const fieldLogic = readLogic(field);
  const ruleCount = countRules(fieldLogic);

  const FieldIcon = getIcon(field.type);
  const typeLabel = definition?.label || field.type?.replace(/_/g, ' ');
  const typeDescription =
    typeof definition?.meta?.description === 'string' ? definition.meta.description.trim() : '';
  const displayLabel =
    String(field.label || '').trim() || String(field.title || '').trim() || typeLabel;
  const fieldKey = field.key;
  // IDs the field cannot take: the other fields of its namespace (the form,
  // or the Repeater it is in), the same rule the server applies.
  // (Computed directly: a hook here would follow the early return above.)
  const usedKeys = tree ? namespaceKeys(denormalizeTree(tree), selectedId) : new Set();

  // Step rules come from an add-on's logic editor; without one the section is
  // shown only to say that saved rules are kept.
  const showLogicOnlyTab = !isStep || !!getLogicEditor() || ruleCount > 0;
  const showLogic = isInputLike || (isLogicOnlyType(field.type) && showLogicOnlyTab);

  // Quick rows: only for fields that take an answer.
  const showRequired = isInputLike && !NO_REQUIRED.has(field.type) && !typeHasFlag(field.type, 'noMessages');
  const showWidth = isInputLike && supportsAppearance(field.type);
  const showQuick = isInputLike;

  const controls = resolveControls(definition);
  const hasContent = controls.some(pickers.content) || showsStepSetting(tree, selectedId);
  const hasSubfields = controls.some(pickers.subfields);
  const hasTypeControls = controls.some(pickers.type);
  const hasRules = isInputLike && hasControls(definition, (c) => c.section === 'validation');
  const hasAdvanced = controls.some(pickers.advanced);
  const isChoice = isChoiceType(field.type);
  const isChained = field.type === 'chained_select';
  const hasStyle = supportsAppearance(field.type);
  // The Styles tab: the `appearance` controls in groups named after what they
  // do, then the field's own look (layout, colours, text and shape).
  const stylesGroups = styleGroups().filter((g) => controls.some(styleGroupPicker(g.id)));
  const hasStylesTab = stylesGroups.length > 0 || hasStyle;
  const tab = hasStylesTab ? savedTab : 'settings';
  const drawsAnything =
    hasContent || hasSubfields || hasTypeControls || hasRules || hasAdvanced || isChoice || isChained || showLogic || hasStylesTab || showQuick;

  const requiredHelp = field.required
    ? __('Visitors must answer before the form can be sent.', 'subtleforms')
    : __('Visitors can leave this empty.', 'subtleforms');

  const openLogic = (add) => {
    setTab('settings');
    logicState[1](true);
    setPending({ section: 'logic', add });
  };

  const logicIntro = isStep
    ? __('Skip this step unless its rules match. Fields in a skipped step are not checked or saved.', 'subtleforms')
    : isRepeater
    ? __('Show or hide this repeater based on answers to other fields. A hidden repeater, including every row inside it, is not checked or saved.', 'subtleforms')
    : typeof definition?.meta?.logicHelp === 'string' && definition.meta.logicHelp
    ? definition.meta.logicHelp
    : sprintf(
        /* translators: %s: field label */
        __('Show or hide “%s” based on answers to other fields. Hidden fields are not checked or saved.', 'subtleforms'),
        field.label || typeLabel
      );

  return (
    <div className='sf-field-inspector' ref={rootRef}>
      <div className='sf-field-inspector__top'>
      <div className='sf-field-inspector__header'>
        <span className='sf-field-inspector__type-icon' aria-hidden='true'>
          <FieldIcon size={16} />
        </span>
        <div className='sf-field-inspector__header-info'>
          <strong className='sf-field-inspector__title'>{displayLabel}</strong>
          <span
            className={`sf-field-inspector__description${typeDescription ? '' : ' is-fallback'}`}>
            {typeDescription || typeLabel}
          </span>
          {fieldKey && (
            <FieldKeyEditor
              nodeId={selectedId}
              fieldKey={fieldKey}
              usedKeys={usedKeys}
              onRename={actions.onRenameKey}
              entryCount={entryCount}
              isReadOnly={isReadOnly}
            />
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

      {hasStylesTab && <InspectorTabs tab={tab} onChange={setTab} idBase={tabBase} />}
      </div>

      <div className='sf-field-inspector__scroll'>
      {(validationMessages.length > 0 || fieldWarnings.length > 0) && (
        <div className='sf-field-inspector__notices'>
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

      <div
        className='sf-field-inspector__sheet'
        key={field.id ?? 'none'}
        role={hasStylesTab ? 'tabpanel' : undefined}
        id={hasStylesTab ? `${tabBase}-panel` : undefined}
        aria-labelledby={hasStylesTab ? `${tabBase}-tab-${tab}` : undefined}>
        {tab === 'settings' && showQuick && (
          <div className='sf-field-inspector__quick' data-section='quick'>
            {showRequired && (
              <ToggleInspectorControl
                layout='row'
                label={__('Required', 'subtleforms')}
                icon={<AsteriskGlyph />}
                value={!!field.required}
                onText={__('must answer', 'subtleforms')}
                offText={__('visitors may skip', 'subtleforms')}
                help={requiredHelp}
                disabled={isReadOnly}
                onChange={(checked) => handleUpdate({ required: checked })}
              />
            )}
            {showWidth && (
              <WidthRow field={field} onUpdate={handleUpdate} isReadOnly={isReadOnly} />
            )}
            <VisibilityRow hasRules={ruleCount > 0} onOpen={() => openLogic(false)} />
          </div>
        )}

        {tab === 'settings' && hasContent && (
          <InspectorSection id='content' title={__('Content', 'subtleforms')}>
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
              pick={pickers.content}
              showEmpty={false}
            />
          </InspectorSection>
        )}

        {tab === 'settings' && isChoice && (
          <InspectorSection
            id='choices'
            title={__('Choices', 'subtleforms')}
            state={choicesState}
            action={{
              label: bulk ? __('Cancel', 'subtleforms') : __('Paste list', 'subtleforms'),
              disabled: isReadOnly,
              onClick: () => {
                choicesState[1](true);
                setBulk((current) => !current);
              },
            }}>
            <OptionsPanel
              field={field}
              onUpdate={handleUpdate}
              isReadOnly={isReadOnly}
              bulk={bulk}
              onBulkChange={setBulk}
            />
          </InspectorSection>
        )}

        {tab === 'settings' && isChained && (
          <InspectorSection id='dropdowns' title={__('Dropdowns', 'subtleforms')}>
            <div className='sf-prow sf-prow--wide sf-prow--bare'>
              <ChainedDisplayControl
                value={field.presentation}
                onChange={(presentation) => handleUpdate({ presentation })}
                disabled={isReadOnly}
              />
              <ChainedSourceControl
                field={field}
                onChange={handleUpdate}
                disabled={isReadOnly}
              />
              {chainedUsesCsv(field) ? (
                <ChainedCsvControl
                  levels={field.levels}
                  fileName={field.csvFileName}
                  onChange={handleUpdate}
                  disabled={isReadOnly}
                />
              ) : (
                <ChainedLevelsControl
                  value={field.levels}
                  onChange={(levels) => handleUpdate({ levels })}
                  disabled={isReadOnly}
                />
              )}
            </div>
          </InspectorSection>
        )}

        {tab === 'settings' && hasSubfields && (
          <InspectorSection id='subfields' title={__('Sub-fields', 'subtleforms')}>
            <DynamicInspectorPanel
              field={field}
              onUpdate={handleUpdate}
              isReadOnly={isReadOnly}
              pick={pickers.subfields}
              showEmpty={false}
            />
          </InspectorSection>
        )}

        {tab === 'settings' && hasTypeControls && (
          <InspectorSection
            id='type'
            title={sprintf(
              /* translators: %s: field type, for example Repeater */
              __('%s settings', 'subtleforms'),
              typeLabel
            )}>
            <DynamicInspectorPanel
              field={field}
              onUpdate={handleUpdate}
              isReadOnly={isReadOnly}
              pick={pickers.type}
              showEmpty={false}
            />
          </InspectorSection>
        )}

        {tab === 'settings' && hasRules && (
          <InspectorSection
            id='rules'
            title={__('Rules', 'subtleforms')}
            badge={
              validationMessages.length > 0 ? (
                <span
                  className='sf-isec__dot'
                  role='img'
                  aria-label={__('Needs attention', 'subtleforms')}
                />
              ) : null
            }>
            <ValidationPanel
              field={field}
              onUpdate={handleUpdate}
              isReadOnly={isReadOnly}
            />
          </InspectorSection>
        )}

        {tab === 'settings' && showLogic && (
          <InspectorSection
            id='logic'
            title={__('Logic', 'subtleforms')}
            state={logicState}
            badge={ruleCount > 0 ? ruleCount : null}
            action={{
              label: __('+ Rule', 'subtleforms'),
              disabled: isReadOnly,
              onClick: () => openLogic(true),
            }}>
            <p className='sf-field-inspector__intro'>{logicIntro}</p>
            <div className={`sf-field-inspector__logic${ruleCount === 0 && !fieldLogic ? ' is-empty' : ''}`}>
              <LogicEditor
                logic={fieldLogic}
                availableFields={(allFields || []).filter((f) => f.key !== field.key)}
                scope={isStep ? 'step' : 'field'}
                panel
                disabled={isReadOnly}
                emptyText={
                  isStep
                    ? __('This step is always shown.', 'subtleforms')
                    : __('No rules yet. Show, hide or require this field based on another answer.', 'subtleforms')
                }
                onChange={(logic) => handleUpdate({ logic, conditions: [] })}
              />
            </div>
          </InspectorSection>
        )}

        {tab === 'styles' && (
          <>
            {stylesGroups.map((group) => (
              <InspectorSection key={group.id} id={`style-${group.id}`} title={group.title}>
                <DynamicInspectorPanel
                  field={field}
                  onUpdate={handleUpdate}
                  isReadOnly={isReadOnly}
                  pick={styleGroupPicker(group.id)}
                  showEmpty={false}
                />
              </InspectorSection>
            ))}
            {hasStyle && (
              <FieldAppearancePanel
                field={field}
                onUpdate={handleUpdate}
                formAppearance={formAppearance}
                isReadOnly={isReadOnly}
                hideWidth={showWidth}
              />
            )}
          </>
        )}

        {tab === 'settings' && hasAdvanced && (
          <InspectorSection id='advanced' title={__('Advanced', 'subtleforms')}>
            <DynamicInspectorPanel
              field={field}
              onUpdate={handleUpdate}
              isReadOnly={isReadOnly}
              pick={pickers.advanced}
              showEmpty={false}
            />
          </InspectorSection>
        )}

        {!drawsAnything && (
          <Notice status='info' isDismissible={false} className='sf-dynamic-inspector__empty'>
            {isLayout
              ? __('Layout field: configure via canvas', 'subtleforms')
              : __('No configurable settings for this field type.', 'subtleforms')}
          </Notice>
        )}
      </div>
      </div>

      <div className='sf-field-inspector__footer'>
        <span className='sf-field-inspector__hints'>
          <span>
            <kbd>Esc</kbd> {__('back to canvas', 'subtleforms')}
          </span>
          <span aria-hidden='true'>·</span>
          <span>
            <kbd>Del</kbd> {__('delete', 'subtleforms')}
          </span>
        </span>
      </div>
    </div>
  );
}

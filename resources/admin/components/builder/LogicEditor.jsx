/**
 * LogicEditor, conditional logic rules for a field, step, email or
 * confirmation (2.1).
 *
 * Writes the shared logic shape evaluated by shared/conditions.js in the
 * browser and Engine/ConditionalLogic.php on the server:
 *
 *   { action, groups: [ { match: 'all' | 'any', rules: [ { field, operator, value, value2 } ] } ] }
 *
 * Every option is available: "all" or "any" per group, several groups
 * (OR) and every operator.
 */
import { Button, SelectControl, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import Icon from '../../ui/Icon';
import { nodeLogics, VALUELESS_OPERATORS } from '../../../shared/conditions';
import './LogicEditor.scss';

const OPERATOR_LABELS = {
  equals: __('is', 'subtleforms'),
  not_equals: __('is not', 'subtleforms'),
  contains: __('contains', 'subtleforms'),
  not_contains: __('does not contain', 'subtleforms'),
  empty: __('is empty', 'subtleforms'),
  not_empty: __('is not empty', 'subtleforms'),
  greater_than: __('is greater than', 'subtleforms'),
  less_than: __('is less than', 'subtleforms'),
  starts_with: __('starts with', 'subtleforms'),
  ends_with: __('ends with', 'subtleforms'),
  in: __('is one of', 'subtleforms'),
  not_in: __('is not one of', 'subtleforms'),
  between: __('is between', 'subtleforms'),
  before: __('is before (date)', 'subtleforms'),
  after: __('is after (date)', 'subtleforms'),
};

const BASIC_ORDER = ['equals', 'not_equals', 'contains', 'not_contains', 'empty', 'not_empty', 'greater_than', 'less_than'];
const ADVANCED_ORDER = ['starts_with', 'ends_with', 'in', 'not_in', 'between', 'before', 'after'];
const DATE_TYPES = ['date', 'datetime'];

const emptyRule = () => ({ field: '', operator: 'equals', value: '' });

/**
 * The logic to edit: `logic` when set, else the older `conditions` list
 * converted (show/hide only).
 */
export function readLogic(node) {
  if (node?.logic && typeof node.logic === 'object' && Array.isArray(node.logic.groups)) {
    return node.logic;
  }
  const converted = nodeLogics(node || {});
  const first = converted.find((l) => l.action === 'show' || l.action === 'hide');
  return first || null;
}

/** Number of rules with a field chosen. */
export function countRules(logic) {
  if (!logic || !Array.isArray(logic.groups)) return 0;
  return logic.groups.reduce(
    (n, g) => n + (Array.isArray(g.rules) ? g.rules.filter((r) => r && r.field).length : 0),
    0
  );
}

const LAYOUT_TYPES = [
  'step', 'section', 'section_break', 'html', 'form_step', 'page_break', 'hidden_price',
  'payment_summary', 'payment_card', 'captcha', 'recaptcha', 'honeypot', 'action_hook',
];

/**
 * Fields a rule can test, from a schema field tree: { key, label, type, options }.
 */
export function collectLogicFields(nodes, out = []) {
  if (!Array.isArray(nodes)) return out;
  nodes.forEach((n) => {
    if (!n || typeof n !== 'object') return;
    const cfg = n.config && typeof n.config === 'object' ? { ...n, ...n.config } : n;
    const type = n.type || '';
    if (cfg.key && !LAYOUT_TYPES.includes(type) && !type.includes('container')) {
      out.push({ key: cfg.key, label: cfg.label || cfg.key, type, options: cfg.options });
    }
    collectLogicFields(n.children, out);
    collectLogicFields(n.fields, out);
    if (Array.isArray(n.columns)) {
      n.columns.forEach((c) =>
        collectLogicFields(Array.isArray(c) ? c : c?.fields || c?.children, out)
      );
    }
  });
  return out;
}

function optionPairs(options) {
  if (!Array.isArray(options)) return [];
  return options
    .map((o) =>
      o && typeof o === 'object'
        ? { label: String(o.label ?? o.value ?? ''), value: String(o.value ?? o.label ?? '') }
        : { label: String(o), value: String(o) }
    )
    .filter((o) => o.value !== '');
}

export default function LogicEditor({
  logic,
  availableFields = [],
  onChange,
  showAction = true,
  actions = ['show', 'hide'],
  disabled = false,
  emptyText,
  addLabel,
}) {
  const readOnly = disabled;
  const current = logic && Array.isArray(logic.groups) ? logic : null;
  const groups = current?.groups?.length ? current.groups : [];
  const action = current?.action || actions[0];

  const commit = (nextGroups, nextAction = action) => {
    if (readOnly) return;
    onChange(
      nextGroups.length
        ? { action: showAction ? nextAction : undefined, groups: nextGroups }
        : null
    );
  };

  const updateGroup = (gi, patch) =>
    commit(groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)));

  const updateRule = (gi, ri, patch) =>
    updateGroup(gi, {
      rules: groups[gi].rules.map((r, i) => (i === ri ? { ...r, ...patch } : r)),
    });

  const removeRule = (gi, ri) => {
    const rules = groups[gi].rules.filter((_, i) => i !== ri);
    if (rules.length) {
      updateGroup(gi, { rules });
    } else {
      commit(groups.filter((_, i) => i !== gi));
    }
  };

  const addRule = (gi) =>
    groups.length
      ? updateGroup(gi, { rules: [...groups[gi].rules, emptyRule()] })
      : commit([{ match: 'all', rules: [emptyRule()] }]);

  const addGroup = () => {
    commit([...groups, { match: 'all', rules: [emptyRule()] }]);
  };

  const fieldOptions = [
    { label: __('Choose a field…', 'subtleforms'), value: '' },
    ...availableFields
      .filter((f) => f && f.key)
      .map((f) => ({ label: f.label || f.key, value: f.key })),
  ];

  const operatorOptions = [
    ...BASIC_ORDER.map((op) => ({ label: OPERATOR_LABELS[op], value: op })),
    ...ADVANCED_ORDER.map((op) => ({ label: OPERATOR_LABELS[op], value: op })),
  ];

  return (
    <div className='sf-logic-editor'>

      {showAction && groups.length > 0 && (
        <div className='sf-logic-editor__action'>
          <SelectControl
            __nextHasNoMarginBottom
            __next40pxDefaultSize
            label={__('Action', 'subtleforms')}
            hideLabelFromVision
            value={action}
            disabled={readOnly}
            options={actions.map((a) => ({
              value: a,
              label: a === 'show' ? __('Show when', 'subtleforms') : __('Hide when', 'subtleforms'),
            }))}
            onChange={(v) => commit(groups, v)}
          />
        </div>
      )}

      {groups.length === 0 && (
        <p className='sf-logic-editor__empty'>
          {emptyText || __('Always shown. Add a rule to show or hide it based on answers.', 'subtleforms')}
        </p>
      )}

      {groups.map((group, gi) => (
        <div key={gi} className='sf-logic-editor__group-wrap'>
          {gi > 0 && (
            <div className='sf-logic-editor__or' aria-hidden='true'>
              <span>{__('or', 'subtleforms')}</span>
            </div>
          )}
          <div className='sf-logic-editor__group'>
            <div className='sf-logic-editor__group-head'>
              <SelectControl
                __nextHasNoMarginBottom
                label={__('Match', 'subtleforms')}
                hideLabelFromVision
                className='sf-logic-editor__match'
                value={group.match === 'any' ? 'any' : 'all'}
                disabled={readOnly}
                options={[
                  { value: 'all', label: __('All of these rules', 'subtleforms') },
                  { value: 'any', label: __('Any of these rules', 'subtleforms') },
                ]}
                onChange={(v) => updateGroup(gi, { match: v })}
              />
              {groups.length > 1 && (
                <Button
                  size='small'
                  variant='tertiary'
                  isDestructive
                  disabled={readOnly}
                  onClick={() => commit(groups.filter((_, i) => i !== gi))}>
                  {__('Remove group', 'subtleforms')}
                </Button>
              )}
            </div>

            {group.rules.map((rule, ri) => {
              const source = availableFields.find((f) => f.key === (rule.field || rule.sourceField));
              const choices = optionPairs(source?.options);
              const op = rule.operator || 'equals';
              const needsValue = !VALUELESS_OPERATORS.includes(op);
              const isDate = op === 'before' || op === 'after' || DATE_TYPES.includes(source?.type);
              const useChoices = choices.length > 0 && ['equals', 'not_equals', 'contains', 'not_contains'].includes(op);

              return (
                <div key={ri} className='sf-logic-editor__rule'>
                  <div className='sf-logic-editor__rule-row'>
                    <SelectControl
                      __nextHasNoMarginBottom
                      label={__('Field', 'subtleforms')}
                      hideLabelFromVision
                      value={rule.field || rule.sourceField || ''}
                      disabled={readOnly}
                      options={fieldOptions}
                      onChange={(v) => updateRule(gi, ri, { field: v, sourceField: undefined })}
                    />
                    <Button
                      className='sf-logic-editor__remove'
                      icon={<Icon.Close size={16} />}
                      label={__('Remove rule', 'subtleforms')}
                      size='small'
                      disabled={readOnly}
                      onClick={() => removeRule(gi, ri)}
                    />
                  </div>
                  <SelectControl
                    __nextHasNoMarginBottom
                    label={__('Condition', 'subtleforms')}
                    hideLabelFromVision
                    value={op}
                    disabled={readOnly}
                    options={operatorOptions}
                    onChange={(v) => updateRule(gi, ri, { operator: v })}
                  />
                  {needsValue && useChoices && (
                    <SelectControl
                      __nextHasNoMarginBottom
                      label={__('Value', 'subtleforms')}
                      hideLabelFromVision
                      value={String(rule.value ?? '')}
                      disabled={readOnly}
                      options={[{ label: __('Choose…', 'subtleforms'), value: '' }, ...choices]}
                      onChange={(v) => updateRule(gi, ri, { value: v })}
                    />
                  )}
                  {needsValue && !useChoices && op !== 'between' && (
                    <TextControl
                      __nextHasNoMarginBottom
                      label={__('Value', 'subtleforms')}
                      hideLabelFromVision
                      type={isDate && op !== 'in' && op !== 'not_in' && String(rule.value || '') !== 'today' ? 'date' : 'text'}
                      placeholder={
                        op === 'in' || op === 'not_in'
                          ? __('Values separated by commas', 'subtleforms')
                          : __('Value', 'subtleforms')
                      }
                      value={String(rule.value ?? '')}
                      disabled={readOnly}
                      onChange={(v) => updateRule(gi, ri, { value: v })}
                    />
                  )}
                  {op === 'between' && (
                    <div className='sf-logic-editor__between'>
                      <TextControl
                        __nextHasNoMarginBottom
                        label={__('From', 'subtleforms')}
                        hideLabelFromVision
                        placeholder={__('From', 'subtleforms')}
                        type={isDate ? 'date' : 'text'}
                        value={String(rule.value ?? '')}
                        disabled={readOnly}
                        onChange={(v) => updateRule(gi, ri, { value: v })}
                      />
                      <span aria-hidden='true'>{__('and', 'subtleforms')}</span>
                      <TextControl
                        __nextHasNoMarginBottom
                        label={__('To', 'subtleforms')}
                        hideLabelFromVision
                        placeholder={__('To', 'subtleforms')}
                        type={isDate ? 'date' : 'text'}
                        value={String(rule.value2 ?? '')}
                        disabled={readOnly}
                        onChange={(v) => updateRule(gi, ri, { value2: v })}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            <Button
              variant='link'
              className='sf-logic-editor__add-rule'
              disabled={readOnly}
              onClick={() => addRule(gi)}>
              {__('+ Add rule', 'subtleforms')}
            </Button>
          </div>
        </div>
      ))}

      <div className='sf-logic-editor__footer'>
        {groups.length === 0 ? (
          <Button variant='secondary' size='compact' disabled={readOnly} onClick={() => addRule(0)}>
            {addLabel || __('Add rule', 'subtleforms')}
          </Button>
        ) : (
          <Button variant='tertiary' size='compact' disabled={readOnly} onClick={addGroup}>
            {__('+ Add “or” group', 'subtleforms')}
          </Button>
        )}
      </div>
    </div>
  );
}

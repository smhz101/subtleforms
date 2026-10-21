/**
 * ActionsPanel, Form-level pipeline action editor
 *
 * Renders a list of schema.actions[] with add/remove/reorder support.
 * Supports: webhook, email
 */

import { useCallback, useMemo, useRef, useId } from '@wordpress/element';
import {
  Button,
  TextControl,
  TextareaControl,
  SelectControl,
  ToggleControl,
  Notice,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import LogicEditor, { collectLogicFields, countRules } from './LogicEditor';
import MergeTagMenu from '../merge-tags/MergeTagMenu';
import MergeTagsHelpLink from '../merge-tags/MergeTagsHelp';
import { insertAt } from '../merge-tags/mergeTags';
import ConnectionTest from '../settings/extensions/ConnectionTest';
import { normalizeWebhookUrl } from '../../utils/webhookUrl';
import Icon from '../../ui/Icon';
import HeadersEditor from './webhook/HeadersEditor';
import PayloadPicker, { currentSelection, payloadMode } from './webhook/PayloadPicker';
import { collectPayloadFields, defaultSelection, formHasPayment, sampleAnswers } from './webhook/webhookModel';

// ─── helpers ────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function normalizeActions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((a) => ({
    id:       a.id      ?? uid(),
    type:     a.type    ?? 'webhook',
    enabled:  a.enabled !== undefined ? a.enabled : true,
    // Templates store email settings under `config` (2.3.1): show them.
    settings: a.settings ?? (a.config && typeof a.config === 'object' ? a.config : {}),
  }));
}

/**
 * What an action still needs before it can run (2.3.1, QA-02). An
 * incomplete action never blocks saving; it shows "Needs setup".
 *
 * @return {string[]} Missing setting names.
 */
export function missingActionSettings(action) {
  const s = action?.settings || {};
  if (action?.type === 'email') {
    return ['to', 'subject'].filter((k) => !String(s[k] || '').trim());
  }
  if (action?.type === 'webhook') {
    return String(s.url || '').trim() ? [] : ['url'];
  }
  return [];
}

/** Default settings shape for a new webhook action */
const DEFAULT_WEBHOOK_SETTINGS = {
  url:            '',
  method:         'POST',
  headers:        {},
  // New webhooks send the ticked data (2.5.0); every webhook saved before
  // keeps the mode it has.
  payload_mode:   'selected',
  payload_selection: [],
  custom_payload: '',
  // Signed by default; SubtleForms Pro creates a secret for each webhook
  // when the form is saved (2.3.0).
  signing: {
    enabled: true,
    secret:  '',
  },
};

/** Default settings shape for a new email action */
const DEFAULT_EMAIL_SETTINGS = {
  to:      '{admin_email}',
  subject: __('New entry: {form_title}', 'subtleforms'),
  message: '',
  format:  'html',
};

const ACTION_LABELS = {
  webhook: __('Webhook',            'subtleforms'),
  email:   __('Email notification', 'subtleforms'),
};

const ACTION_DESCRIPTIONS = {
  webhook: __('Send the form data to an API endpoint', 'subtleforms'),
  email:   __('Send an email after form submission',   'subtleforms'),
};

const METHOD_OPTIONS = [
  { label: 'POST', value: 'POST' },
  { label: 'PUT',  value: 'PUT'  },
  { label: 'PATCH', value: 'PATCH' },
];

// ─── MergeTagField ──────────────────────────────────────────────────────────

/**
 * A setting with its own label and an "Insert tag" menu that puts a merge
 * tag at the cursor (2.3.0).
 */
function MergeTagField({ label, fields, value, onChange, disabled, allowAll = true, render }) {
  const ref = useRef(null);
  const labelId = `sf-merge-tag-label-${useId()}`;
  const insert = (tag) => {
    const el = ref.current;
    const start = el && typeof el.selectionStart === 'number' && document.activeElement === el ? el.selectionStart : null;
    const end = el && typeof el.selectionEnd === 'number' && document.activeElement === el ? el.selectionEnd : null;
    const next = insertAt(value, tag, start, end);
    onChange(next.value);
    window.requestAnimationFrame(() => {
      if (el && typeof el.setSelectionRange === 'function') {
        el.focus();
        el.setSelectionRange(next.caret, next.caret);
      }
    });
  };
  return (
    <div className='sf-merge-tag-field'>
      <div className='sf-merge-tag-field__bar'>
        <span id={labelId} className='sf-merge-tag-field__label'>{label}</span>
        <MergeTagMenu fields={fields} onInsert={insert} disabled={disabled} allowAll={allowAll} target={label} />
      </div>
      {render(ref, labelId)}
    </div>
  );
}

// ─── SortableActionItem ──────────────────────────────────────────────────────

/**
 * "Only when" conditions on an action (2.1). The action is skipped when
 * its rules do not match; saving the entry always happens.
 */
function ActionConditions({ settings, fields, disabled, onChange }) {
  const logic = settings.logic && Array.isArray(settings.logic.groups) ? settings.logic : null;
  const count = countRules(logic);

  return (
    <details className='sf-actions-panel__conditions' open={count > 0 || undefined}>
      <summary>
        {__('Only when…', 'subtleforms')}
        <span className='sf-actions-panel__conditions-state'>
          {count > 0 ? __('Conditional', 'subtleforms') : __('Every submission', 'subtleforms')}
        </span>
      </summary>
      <LogicEditor
        logic={logic}
        availableFields={fields}
        showAction={false}
        disabled={disabled}
        emptyText={__('Runs for every submission. Add a rule to run it only for some answers.', 'subtleforms')}
        onChange={(next) => onChange(next)}
      />
    </details>
  );
}

function SortableActionItem({ action, index, isReadOnly, onUpdate, onRemove, fields, payloadFields, hasPayment, form }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: action.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const s         = action.settings ?? {};
  const signing   = s.signing ?? {};
  const isDisabled = isReadOnly || !action.enabled;
  const missing    = missingActionSettings(action);
  // Field warnings only matter while the action is switched on.
  const showWarnings = action.enabled && missing.length > 0;

  /** Merge a patch into settings */
  const patchSettings = (patch) => onUpdate(index, { settings: { ...s, ...patch } });
  const patchSigning  = (patch) => patchSettings({ signing: { ...signing, ...patch } });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sf-actions-panel__item sf-actions-panel__item--${action.type}${isDragging ? ' is-dragging' : ''}${!action.enabled ? ' is-disabled' : ''}`}>

      {/* ── Header row ── */}
      <div className='sf-actions-panel__item-header'>
        <span
          className='sf-actions-panel__drag-handle'
          {...attributes}
          {...listeners}
          aria-label={__('Drag to reorder', 'subtleforms')}
          title={__('Drag to reorder', 'subtleforms')}>
          ⠿
        </span>

        <div className='sf-actions-panel__item-label'>
          <span className='sf-actions-panel__item-type'>
            {ACTION_LABELS[action.type] ?? action.type}
          </span>
          {action.type === 'webhook' && (
            <span className='sf-actions-panel__item-summary'>
              {s.url
                ? `Webhook → ${s.url.replace(/^https?:\/\//, '').split('/')[0].slice(0, 40)}`
                : ACTION_DESCRIPTIONS.webhook}
            </span>
          )}
          {missing.length > 0 && (
            <span className='sf-actions-panel__needs-setup'>
              {__('Needs setup', 'subtleforms')}
            </span>
          )}
          {action.type === 'email' && (
            <span className='sf-actions-panel__item-summary'>
              {s.to
                ? `Email → ${s.to.slice(0, 40)}`
                : ACTION_DESCRIPTIONS.email}
            </span>
          )}
        </div>

        <div className='sf-actions-panel__item-controls'>
          <ToggleControl
            label={__('Enabled', 'subtleforms')}
            hideLabelFromVision
            checked={action.enabled}
            onChange={(v) => onUpdate(index, { enabled: v })}
            disabled={isReadOnly}
          />
          <Button
            variant='tertiary'
            isDestructive
            size='small'
            disabled={isReadOnly}
            onClick={() => onRemove(index)}>
            {__('Remove', 'subtleforms')}
          </Button>
        </div>
      </div>

      {/* ── Email body ── */}
      {action.type === 'email' && (
        <div className='sf-actions-panel__item-body'>

          <MergeTagField
            label={__('To', 'subtleforms')}
            fields={fields}
            allowAll={false}
            disabled={isDisabled}
            value={s.to || ''}
            onChange={(v) => patchSettings({ to: v })}
            render={(ref, labelId) => (
              <TextControl
                ref={ref}
                aria-labelledby={labelId}
                hideLabelFromVision
                label={__('To', 'subtleforms')}
                type='text'
                value={s.to || ''}
                onChange={(v) => patchSettings({ to: v })}
                placeholder='recipient@example.com'
                disabled={isDisabled}
                className={!s.to ? 'sf-field--empty' : ''}
                help={__('An address, several separated by commas, or a field tag such as {field:email}.', 'subtleforms')}
              />
            )}
          />
          {showWarnings && !s.to && (
            <Notice status='warning' isDismissible={false} className='sf-actions-panel__field-notice'>
              {__('A recipient email address is required.', 'subtleforms')}
            </Notice>
          )}

          <MergeTagField
            label={__('Subject', 'subtleforms')}
            fields={fields}
            allowAll={false}
            disabled={isDisabled}
            value={s.subject || ''}
            onChange={(v) => patchSettings({ subject: v })}
            render={(ref, labelId) => (
              <TextControl
                ref={ref}
                aria-labelledby={labelId}
                hideLabelFromVision
                label={__('Subject', 'subtleforms')}
                type='text'
                value={s.subject || ''}
                onChange={(v) => patchSettings({ subject: v })}
                placeholder={__('New entry from {field:name}', 'subtleforms')}
                disabled={isDisabled}
                className={!s.subject ? 'sf-field--empty' : ''}
              />
            )}
          />
          {showWarnings && !s.subject && (
            <Notice status='warning' isDismissible={false} className='sf-actions-panel__field-notice'>
              {__('A subject line is required.', 'subtleforms')}
            </Notice>
          )}

          <MergeTagField
            label={__('Message', 'subtleforms')}
            fields={fields}
            disabled={isDisabled}
            value={s.message || ''}
            onChange={(v) => patchSettings({ message: v })}
            render={(ref, labelId) => (
              <TextareaControl
                ref={ref}
                aria-labelledby={labelId}
                hideLabelFromVision
                label={__('Message', 'subtleforms')}
                value={s.message || ''}
                rows={6}
                onChange={(v) => patchSettings({ message: v })}
                placeholder={__('Hello,\n\nYou received a new entry on {form_title}:\n\n{all_fields}', 'subtleforms')}
                disabled={isDisabled}
              />
            )}
          />
          <p className='sf-actions-panel__hint'>
            {__('Leave the message empty to send every answer ({all_fields}).', 'subtleforms')}{' '}
            <MergeTagsHelpLink />
          </p>

          <ToggleControl
            label={__('Send as HTML', 'subtleforms')}
            help={__('Formats the email with line breaks, rich text and a table for {all_fields}. Off sends plain text.', 'subtleforms')}
            checked={s.format === 'html'}
            onChange={(v) => patchSettings({ format: v ? 'html' : 'text' })}
            disabled={isDisabled}
          />

          <ActionConditions
            settings={s}
            fields={fields}
            disabled={isDisabled}
            onChange={(logic) => patchSettings({ logic })}
          />

        </div>
      )}

      {/* ── Webhook body ── */}
      {action.type === 'webhook' && (
        <div className='sf-actions-panel__item-body'>

          {/* URL */}
          <TextControl
            label={__('Webhook URL', 'subtleforms')}
            type='url'
            value={s.url || ''}
            onChange={(v) => patchSettings({ url: v })}
            onBlur={() => {
              const url = normalizeWebhookUrl(s.url);
              if (url !== (s.url || '')) patchSettings({ url });
            }}
            placeholder='https://example.com/webhook'
            disabled={isDisabled}
            help={sprintf(
              /* translators: %s: HTTP method, for example POST */
              __('On every submission SubtleForms sends a %s request to this URL with the data you choose below.', 'subtleforms'),
              s.method || 'POST'
            )}
          />

          <SelectControl
            label={__('HTTP method', 'subtleforms')}
            value={s.method || 'POST'}
            options={METHOD_OPTIONS}
            onChange={(v) => patchSettings({ method: v })}
            disabled={isDisabled}
            className='sf-webhook-method'
          />

          <PayloadPicker
            settings={s}
            fields={payloadFields}
            hasPayment={hasPayment}
            formId={form.id}
            formTitle={form.title}
            siteUrl={form.siteUrl}
            disabled={isDisabled}
            patch={patchSettings}
          />

          {/* Headers */}
          <HeadersEditor
            value={s.headers || {}}
            onChange={(v) => patchSettings({ headers: v })}
            disabled={isDisabled}
          />

          {/* Signing */}
          <div className='sf-actions-panel__signing'>
            <ToggleControl
              label={__('HMAC-SHA256 Signing', 'subtleforms')}
              checked={!!signing.enabled}
              onChange={(v) => patchSigning({ enabled: v })}
              disabled={isDisabled}
              help={__('Adds an X-SubtleForms-Signature header so you can verify requests on your server.', 'subtleforms')}
            />
            {signing.enabled && (
              <TextControl
                label={__('Signing Secret', 'subtleforms')}
                type='text'
                value={signing.secret || ''}
                onChange={(v) => patchSigning({ secret: v })}
                placeholder={__('Created when you save the form', 'subtleforms')}
                disabled={isDisabled}
                help={__('Kept server-side; paste the same value into your endpoint to verify the signature.', 'subtleforms')}
              />
            )}
          </div>

          {/* Test */}
          <div className='sf-webhook-test'>
            <ConnectionTest
              path='/webhooks/test'
              requiresPro={false}
              label={__('Send test', 'subtleforms')}
              disabled={isDisabled || !String(s.url || '').trim()}
              getBody={() => {
                const mode = payloadMode(s);
                return {
                  url: normalizeWebhookUrl(s.url),
                  method: s.method || 'POST',
                  headers: s.headers || {},
                  sign: !!s.signing?.enabled,
                  secret: s.signing?.secret || '',
                  payload_mode: mode,
                  custom_payload: s.custom_payload || '',
                  payload_selection: mode === 'selected' ? currentSelection(s, payloadFields, hasPayment) : [],
                  fields: payloadFields.map((f) => ({ key: f.key, label: f.label, type: f.type })),
                  sample: sampleAnswers(payloadFields),
                  form_title: form.title,
                  form_id: form.id,
                };
              }}
            />
            <p className='sf-webhook-section__help'>
              {__('Sends the example above to your URL now, so you can see the answer your endpoint gives.', 'subtleforms')}
            </p>
          </div>

          <ActionConditions
            settings={s}
            fields={fields}
            disabled={isDisabled}
            onChange={(logic) => patchSettings({ logic })}
          />

        </div>
      )}
    </div>
  );
}

// ─── AddBar ──────────────────────────────────────────────────────────────────

/**
 * The two "add" buttons as one group, shown above the list and, when there
 * are notifications, below it as well (2.5.0).
 */
function AddBar({ isReadOnly, onAddEmail, onAddWebhook, label, position = 'before' }) {
  return (
    <div className={`sf-actions-panel__add sf-actions-panel__add--${position}`} role='group' aria-label={label}>
      <Button variant='secondary' disabled={isReadOnly} onClick={onAddEmail}>
        <Icon.Mail size={16} aria-hidden='true' />
        {__('Send email', 'subtleforms')}
      </Button>
      <Button
        variant='secondary'
        disabled={isReadOnly}
        onClick={onAddWebhook}
        title={__('Send form data to an API endpoint', 'subtleforms')}>
        <Icon.Webhook size={16} aria-hidden='true' />
        {__('Send to webhook', 'subtleforms')}
      </Button>
    </div>
  );
}

// ─── ActionsPanel ────────────────────────────────────────────────────────────

export default function ActionsPanel({ schema, onChange, isReadOnly = false }) {
  const actions = normalizeActions(schema?.actions);
  const logicFields = collectLogicFields(schema?.fields || []);
  const payloadFields = useMemo(() => collectPayloadFields(schema?.fields || []), [schema?.fields]);
  const hasPayment = useMemo(() => formHasPayment(schema?.fields || []), [schema?.fields]);
  const form = useMemo(() => {
    let id = 0;
    try {
      id = Number(new URLSearchParams(window.location.search).get('form_id')) || 0;
    } catch (e) {
      id = 0;
    }
    const meta = schema?.metadata || {};
    return { id, title: meta.title || meta.name || '', siteUrl: window.location.origin };
  }, [schema?.metadata]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const commit = useCallback(
    (nextActions) => onChange({ ...schema, actions: nextActions }),
    [schema, onChange]
  );

  const handleDragEnd = useCallback(
    ({ active, over }) => {
      if (!over || active.id === over.id) return;
      const oldIdx = actions.findIndex((a) => a.id === active.id);
      const newIdx = actions.findIndex((a) => a.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;
      commit(arrayMove(actions, oldIdx, newIdx));
    },
    [actions, commit]
  );

  const handleUpdate = useCallback(
    (index, patch) => {
      if (isReadOnly) return;
      const updated = actions.map((a, i) => (i === index ? { ...a, ...patch } : a));
      commit(updated);
    },
    [actions, commit, isReadOnly]
  );

  const handleRemove = useCallback(
    (index) => {
      if (isReadOnly) return;
      commit(actions.filter((_, i) => i !== index));
    },
    [actions, commit, isReadOnly]
  );

  const handleAddWebhook = useCallback(() => {
    if (isReadOnly) return;
    commit([
      ...actions,
      {
        id:       uid(),
        type:     'webhook',
        enabled:  true,
        settings: { ...DEFAULT_WEBHOOK_SETTINGS, payload_selection: defaultSelection(payloadFields) },
      },
    ]);
  }, [actions, commit, isReadOnly, payloadFields]);

  const handleAddEmail = useCallback(() => {
    if (isReadOnly) return;
    commit([
      ...actions,
      {
        id:       uid(),
        type:     'email',
        enabled:  true,
        settings: { ...DEFAULT_EMAIL_SETTINGS },
      },
    ]);
  }, [actions, commit, isReadOnly]);

  // Contents only: the caller supplies the accordion row. Returning a Panel here
  // put a Panel inside a PanelBody and produced two nested rows with the same
  // title, so opening one revealed another closed row.
  return (
        <div className='sf-actions-panel'>
          {actions.length === 0 && (
            <p className='sf-actions-panel__empty'>
              {__(
                'No notifications yet. Send an email or call a webhook when an entry arrives.',
                'subtleforms'
              )}
            </p>
          )}

          <AddBar
            isReadOnly={isReadOnly}
            onAddEmail={handleAddEmail}
            onAddWebhook={handleAddWebhook}
            label={__('Add a notification', 'subtleforms')}
          />

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}>
            <SortableContext
              items={actions.map((a) => a.id)}
              strategy={verticalListSortingStrategy}>
              {actions.map((action, index) => (
                <SortableActionItem
                  key={action.id}
                  action={action}
                  index={index}
                  isReadOnly={isReadOnly}
                  onUpdate={handleUpdate}
                  onRemove={handleRemove}
                  fields={logicFields}
                  payloadFields={payloadFields}
                  hasPayment={hasPayment}
                  form={form}
                />
              ))}
            </SortableContext>
          </DndContext>

          {actions.length > 0 && (
            <AddBar
              isReadOnly={isReadOnly}
              onAddEmail={handleAddEmail}
              onAddWebhook={handleAddWebhook}
              label={__('Add another notification', 'subtleforms')}
              position='after'
            />
          )}
        </div>
  );
}


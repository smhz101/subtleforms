/**
 * ActionsPanel — Form-level pipeline action editor
 *
 * Renders a list of schema.actions[] with add/remove/reorder support.
 * Supports: webhook, email
 */

import { useCallback } from '@wordpress/element';
import {
  Button,
  TextControl,
  TextareaControl,
  SelectControl,
  ToggleControl,
  Panel,
  PanelBody,
  Notice,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
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
    settings: a.settings ?? {},
  }));
}

/** Default settings shape for a new webhook action */
const DEFAULT_WEBHOOK_SETTINGS = {
  url:            '',
  method:         'POST',
  headers:        {},
  payload_mode:   'full',
  custom_payload: '',
  signing: {
    enabled: false,
    secret:  '',
  },
};

/** Default settings shape for a new email action */
const DEFAULT_EMAIL_SETTINGS = {
  to:      '',
  subject: '',
  message: '',
};

const ACTION_LABELS = {
  webhook: __('Send data to API (Webhook)',   'subtleforms'),
  email:   __('Send Email Notification',      'subtleforms'),
};

const ACTION_DESCRIPTIONS = {
  webhook: __('Send form data to an external API endpoint', 'subtleforms'),
  email:   __('Send an email after form submission',        'subtleforms'),
};

const METHOD_OPTIONS = [
  { label: 'POST', value: 'POST' },
  { label: 'PUT',  value: 'PUT'  },
  { label: 'PATCH', value: 'PATCH' },
];

const PAYLOAD_MODE_OPTIONS = [
  { label: __('Full submission data', 'subtleforms'), value: 'full'   },
  { label: __('Custom data (JSON)',    'subtleforms'), value: 'custom' },
];

// ─── HeadersEditor ──────────────────────────────────────────────────────────

/**
 * Simple key/value textarea that stores headers as a JSON object.
 * Shows raw JSON so power-users can paste in bulk; validates on change.
 */
function HeadersEditor({ value, onChange, disabled }) {
  const jsonStr = typeof value === 'object' && value !== null
    ? JSON.stringify(value, null, 2)
    : '{}';

  return (
    <TextareaControl
      label={__('Custom headers (advanced)', 'subtleforms')}
      value={jsonStr}
      rows={4}
      disabled={disabled}
      onChange={(raw) => {
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            onChange(parsed);
          }
        } catch (_) {
          // Let the user keep typing; don't propagate invalid JSON
        }
      }}
      help={__('JSON object of extra HTTP headers. Example: {"X-Source": "subtleforms"}', 'subtleforms')}
    />
  );
}

// ─── SortableActionItem ──────────────────────────────────────────────────────

function SortableActionItem({ action, index, isReadOnly, onUpdate, onRemove }) {
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

  /** Merge a patch into settings */
  const patchSettings = (patch) => onUpdate(index, { settings: { ...s, ...patch } });
  const patchSigning  = (patch) => patchSettings({ signing: { ...signing, ...patch } });

  /** Validate custom_payload: must be empty or valid JSON */
  let customPayloadError = null;
  if (s.payload_mode === 'custom' && s.custom_payload) {
    try { JSON.parse(s.custom_payload); }
    catch (_) { customPayloadError = __('Invalid JSON', 'subtleforms'); }
  }

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

          <TextControl
            label={__('To', 'subtleforms')}
            type='email'
            value={s.to || ''}
            onChange={(v) => patchSettings({ to: v })}
            placeholder='recipient@example.com'
            disabled={isDisabled}
            className={!s.to ? 'sf-field--empty' : ''}
            help={__('You can use {{field_name}} to include form data. e.g. {{email}}', 'subtleforms')}
          />
          {!s.to && (
            <Notice status='warning' isDismissible={false} className='sf-actions-panel__field-notice'>
              {__('A recipient email address is required.', 'subtleforms')}
            </Notice>
          )}

          <TextControl
            label={__('Subject', 'subtleforms')}
            type='text'
            value={s.subject || ''}
            onChange={(v) => patchSettings({ subject: v })}
            placeholder={__('New submission from {{name}}', 'subtleforms')}
            disabled={isDisabled}
            className={!s.subject ? 'sf-field--empty' : ''}
            help={__('You can use {{field_name}} to include form data.', 'subtleforms')}
          />
          {!s.subject && (
            <Notice status='warning' isDismissible={false} className='sf-actions-panel__field-notice'>
              {__('A subject line is required.', 'subtleforms')}
            </Notice>
          )}

          <TextareaControl
            label={__('Message', 'subtleforms')}
            value={s.message || ''}
            rows={6}
            onChange={(v) => patchSettings({ message: v })}
            placeholder={__('Hello,\n\nYou received a new submission:\n\nName: {{name}}\nEmail: {{email}}', 'subtleforms')}
            disabled={isDisabled}
            className={!s.message ? 'sf-field--empty' : ''}
            help={__('You can use {{field_name}} to include form data. Leave empty to send all submitted data.', 'subtleforms')}
          />
          {!s.message && (
            <Notice status='info' isDismissible={false} className='sf-actions-panel__field-notice'>
              {__('No message set — the full submission data will be sent as JSON.', 'subtleforms')}
            </Notice>
          )}

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
            placeholder='https://example.com/webhook'
            disabled={isDisabled}
          />

          {/* Method + Payload mode — side by side */}
          <div className='sf-actions-panel__row'>
            <SelectControl
              label={__('HTTP Method', 'subtleforms')}
              value={s.method || 'POST'}
              options={METHOD_OPTIONS}
              onChange={(v) => patchSettings({ method: v })}
              disabled={isDisabled}
            />
            <SelectControl
              label={__('Payload Mode', 'subtleforms')}
              value={s.payload_mode || 'full'}
              options={PAYLOAD_MODE_OPTIONS}
              onChange={(v) => patchSettings({ payload_mode: v })}
              disabled={isDisabled}
            />
          </div>

          {/* Custom payload */}
          {s.payload_mode === 'custom' && (
            <>
              <TextareaControl
                label={__('Custom JSON Payload', 'subtleforms')}
                value={s.custom_payload || ''}
                rows={5}
                onChange={(v) => patchSettings({ custom_payload: v })}
                placeholder={'{\n  "name": "{{name}}",\n  "email": "{{email}}"\n}'}
                disabled={isDisabled}
              />
              {customPayloadError && (
                <Notice status='error' isDismissible={false}>
                  {customPayloadError}
                </Notice>
              )}
            </>
          )}

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
                placeholder={__('Your secret key', 'subtleforms')}
                disabled={isDisabled}
                help={__('Kept server-side; paste the same value into your endpoint to verify the signature.', 'subtleforms')}
              />
            )}
          </div>

        </div>
      )}
    </div>
  );
}

// ─── ActionsPanel ────────────────────────────────────────────────────────────

export default function ActionsPanel({ schema, onChange, isReadOnly = false }) {
  const actions = normalizeActions(schema?.actions);

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
        settings: { ...DEFAULT_WEBHOOK_SETTINGS },
      },
    ]);
  }, [actions, commit, isReadOnly]);

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

  return (
    <Panel>
      <PanelBody
        title={__('Actions', 'subtleforms')}
        initialOpen={false}>

        <div className='sf-actions-panel'>
          {actions.length === 0 && (
            <p className='sf-actions-panel__empty'>
              {__(
                'No actions configured. Add an action to process form submissions.',
                'subtleforms'
              )}
            </p>
          )}

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
                />
              ))}
            </SortableContext>
          </DndContext>

          <div className='sf-actions-panel__footer'>
            <Button
              variant='secondary'
              disabled={isReadOnly}
              onClick={handleAddEmail}>
              {__('+ Send Email', 'subtleforms')}
            </Button>
            <Button
              variant='secondary'
              disabled={isReadOnly}
              onClick={handleAddWebhook}>
              {__('+ Send to API', 'subtleforms')}
            </Button>
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}


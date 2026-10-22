/**
 * Form settings panels added in 2.0: what happens after submit, and when the
 * form accepts entries. Both write to schema.metadata and are enforced on the
 * frontend (confirmation) and server (availability).
 */
import {
  TextControl,
  TextareaControl,
  ToggleControl,
  __experimentalToggleGroupControl as ToggleGroupControl,
  __experimentalToggleGroupControlOption as ToggleGroupControlOption,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import ProNotice from '../../ui/ProNotice';
import { getSlotItems } from '../../../shared/extend';

/** Collect `{key}` merge tags from the field tree for the hint line. */
function collectKeys(fields, out = []) {
  if (!Array.isArray(fields)) return out;
  fields.forEach((f) => {
    if (!f || typeof f !== 'object') return;
    const cfg = f.config ?? f;
    if (cfg?.key && !['section', 'container', 'columns', 'group', 'form_step', 'html', 'section_break', 'page_break'].includes(f.type)) {
      out.push(cfg.key);
    }
    collectKeys(f.fields, out);
    collectKeys(f.children, out);
    if (Array.isArray(f.columns)) {
      f.columns.forEach((c) => collectKeys(Array.isArray(c) ? c : c?.fields || c?.children, out));
    }
  });
  return out;
}

export function ConfirmationPanel({ schema, onMetadata, isReadOnly }) {
  const metadata = schema?.metadata || {};
  const c = metadata.confirmation || {};
  const type = c.type || 'message';
  const set = (key, value) => onMetadata('confirmation', { ...c, type, [key]: value });
  const keys = collectKeys(schema?.fields || []).slice(0, 6);

  return (
    <>
      <ToggleGroupControl
        __nextHasNoMarginBottom
        __next40pxDefaultSize
        isBlock
        label={__('Show visitors', 'subtleforms')}
        value={type}
        onChange={(v) => !isReadOnly && onMetadata('confirmation', { ...c, type: v })}>
        <ToggleGroupControlOption value='message' label={__('A message', 'subtleforms')} />
        <ToggleGroupControlOption value='redirect' label={__('Another page', 'subtleforms')} />
      </ToggleGroupControl>

      {type === 'message' ? (
        <>
          <TextControl
            __nextHasNoMarginBottom
            __next40pxDefaultSize
            label={__('Heading', 'subtleforms')}
            value={c.title ?? ''}
            placeholder={__('Thank you!', 'subtleforms')}
            onChange={(v) => set('title', v)}
            disabled={isReadOnly}
          />
          <TextareaControl
            __nextHasNoMarginBottom
            label={__('Message', 'subtleforms')}
            value={c.message ?? ''}
            placeholder={__('Your form has been submitted successfully.', 'subtleforms')}
            onChange={(v) => set('message', v)}
            rows={3}
            disabled={isReadOnly}
            help={
              keys.length
                ? sprintf(
                    /* translators: %s: example merge tags */
                    __('Insert answers with merge tags, for example %s.', 'subtleforms'),
                    keys.map((k) => `{${k}}`).join(' ')
                  )
                : __('Insert answers with merge tags like {email}.', 'subtleforms')
            }
          />
          <ToggleControl
            __nextHasNoMarginBottom
            label={__('Offer “Submit another response”', 'subtleforms')}
            checked={!!c.allowAnother}
            onChange={(v) => set('allowAnother', v)}
            disabled={isReadOnly}
          />
        </>
      ) : (
        <TextControl
          __nextHasNoMarginBottom
          __next40pxDefaultSize
          type='url'
          label={__('Page URL', 'subtleforms')}
          value={c.redirectUrl ?? ''}
          placeholder='https://'
          onChange={(v) => set('redirectUrl', v)}
          disabled={isReadOnly}
          help={__('Merge tags work here too, e.g. ?email={email}.', 'subtleforms')}
        />
      )}

      <ConditionalConfirmations
        schema={schema}
        onMetadata={onMetadata}
        isReadOnly={isReadOnly}
      />

      <TextControl
        __nextHasNoMarginBottom
        __next40pxDefaultSize
        label={__('Submit button text', 'subtleforms')}
        value={metadata.submitText ?? ''}
        placeholder={__('Submit', 'subtleforms')}
        onChange={(v) => !isReadOnly && onMetadata('submitText', v)}
        disabled={isReadOnly}
      />
    </>
  );
}

/**
 * Conditional confirmations: a different message or page for different
 * answers. They are part of SubtleForms Pro, which fills the
 * `form.confirmations` slot with the editor. Without it this shows a Pro note;
 * confirmations already saved on the form are kept and ignored (the default
 * confirmation is used).
 */
function ConditionalConfirmations({ schema, onMetadata, isReadOnly }) {
  const [slot] = getSlotItems('form.confirmations');
  if (slot) {
    const Slot = slot.component;
    return <Slot schema={schema} onMetadata={onMetadata} isReadOnly={isReadOnly} />;
  }
  const saved = Array.isArray(schema?.metadata?.confirmations) ? schema.metadata.confirmations.length : 0;
  return (
    <div className='sf-confirmations'>
      <ProNotice
        label={__('Conditional confirmations', 'subtleforms')}
        help={__('Show a different message or page depending on the answers. Part of SubtleForms Pro.', 'subtleforms')}
        feature='logic.conditional.advanced'
      />
      {saved > 0 && (
        <p className='sf-confirmations__intro'>
          {__('Conditional confirmations are saved on this form. They are ignored and the confirmation above is used until SubtleForms Pro is active.', 'subtleforms')}
        </p>
      )}
    </div>
  );
}

export function AvailabilityPanel({ schema, onMetadata, isReadOnly }) {
  const r = schema?.metadata?.restrictions || {};
  const set = (key, value) => {
    const next = { ...r, [key]: value };
    if (value === '' || value === null || value === undefined) delete next[key];
    onMetadata('restrictions', next);
  };
  return (
    <>
      <p className='sf-form-settings__intro'>
        {__('Limit who can submit and when. Visitors see your message instead of the form.', 'subtleforms')}
      </p>

      <ToggleControl
        __nextHasNoMarginBottom
        label={__('Only logged-in users', 'subtleforms')}
        checked={!!r.requireLogin}
        onChange={(v) => set('requireLogin', v || undefined)}
        disabled={isReadOnly}
      />
      {r.requireLogin && (
        <TextControl
          __nextHasNoMarginBottom
          __next40pxDefaultSize
          label={__('Message for logged-out visitors', 'subtleforms')}
          value={r.loginMessage ?? ''}
          placeholder={__('Please log in to fill in this form.', 'subtleforms')}
          onChange={(v) => set('loginMessage', v)}
          disabled={isReadOnly}
        />
      )}

      <div className='sf-form-settings__row'>
        <TextControl
          __nextHasNoMarginBottom
          __next40pxDefaultSize
          type='datetime-local'
          label={__('Opens', 'subtleforms')}
          value={r.openAt ?? ''}
          onChange={(v) => set('openAt', v)}
          disabled={isReadOnly}
        />
        <TextControl
          __nextHasNoMarginBottom
          __next40pxDefaultSize
          type='datetime-local'
          label={__('Closes', 'subtleforms')}
          value={r.closeAt ?? ''}
          onChange={(v) => set('closeAt', v)}
          disabled={isReadOnly}
        />
      </div>
      {(r.openAt || r.closeAt) && (
        <TextControl
          __nextHasNoMarginBottom
          __next40pxDefaultSize
          label={__('Message when closed', 'subtleforms')}
          value={r.closedMessage ?? ''}
          placeholder={__('This form is closed and no longer accepts entries.', 'subtleforms')}
          onChange={(v) => set('closedMessage', v)}
          disabled={isReadOnly}
          help={__('Times use your site’s timezone (Settings › General).', 'subtleforms')}
        />
      )}

      <TextControl
        __nextHasNoMarginBottom
        __next40pxDefaultSize
        type='number'
        min={0}
        label={__('Maximum entries', 'subtleforms')}
        value={r.entryLimit ? String(r.entryLimit) : ''}
        placeholder={__('No limit', 'subtleforms')}
        onChange={(v) => set('entryLimit', v === '' ? undefined : Math.max(0, parseInt(v, 10) || 0) || undefined)}
        disabled={isReadOnly}
      />
      {!!r.entryLimit && (
        <TextControl
          __nextHasNoMarginBottom
          __next40pxDefaultSize
          label={__('Message when full', 'subtleforms')}
          value={r.limitMessage ?? ''}
          placeholder={__('This form has reached its maximum number of entries.', 'subtleforms')}
          onChange={(v) => set('limitMessage', v)}
          disabled={isReadOnly}
        />
      )}
    </>
  );
}

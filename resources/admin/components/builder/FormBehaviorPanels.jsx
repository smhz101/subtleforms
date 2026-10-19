/**
 * Form settings panels added in 2.0: what happens after submit, and when the
 * form accepts entries. Both write to schema.metadata and are enforced on the
 * frontend (confirmation) and server (availability).
 */
import {
  Button,
  TextControl,
  TextareaControl,
  ToggleControl,
  __experimentalToggleGroupControl as ToggleGroupControl,
  __experimentalToggleGroupControlOption as ToggleGroupControlOption,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import LogicEditor, { collectLogicFields } from './LogicEditor';
import Icon from '../../ui/Icon';

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
 * Conditional confirmations (2.1): a different message or page for
 * different answers. The first one whose rules match is shown; otherwise the
 * default above.
 */
function ConditionalConfirmations({ schema, onMetadata, isReadOnly }) {
  const list = Array.isArray(schema?.metadata?.confirmations) ? schema.metadata.confirmations : [];
  const fields = collectLogicFields(schema?.fields || []);
  const save = (next) => !isReadOnly && onMetadata('confirmations', next);
  const patch = (i, changes) => save(list.map((c, j) => (j === i ? { ...c, ...changes } : c)));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };
  const add = () => {
    save([
      ...list,
      {
        id: `c_${Math.random().toString(36).slice(2, 9)}`,
        label: '',
        type: 'message',
        title: '',
        message: '',
        logic: { groups: [{ match: 'all', rules: [{ field: '', operator: 'equals', value: '' }] }] },
      },
    ]);
  };

  return (
    <div className='sf-confirmations'>
      <p className='components-base-control__label'>{__('Conditional confirmations', 'subtleforms')}</p>
      <p className='sf-confirmations__intro'>
        {list.length
          ? __('The first one whose rules match is shown. Otherwise visitors see the confirmation above.', 'subtleforms')
          : __('Show a different message or page depending on the answers.', 'subtleforms')}
      </p>

      {list.map((c, i) => (
        <div key={c.id || i} className='sf-confirmations__item'>
          <div className='sf-confirmations__head'>
            <TextControl
              __nextHasNoMarginBottom
              label={__('Name', 'subtleforms')}
              hideLabelFromVision
              placeholder={sprintf(
                /* translators: %d: confirmation number */
                __('Confirmation %d', 'subtleforms'),
                i + 1
              )}
              value={c.label ?? ''}
              disabled={isReadOnly}
              onChange={(v) => patch(i, { label: v })}
            />
            <Button
              size='small'
              icon={<Icon.ChevronUp size={16} />}
              label={__('Move up', 'subtleforms')}
              disabled={isReadOnly || i === 0}
              onClick={() => move(i, -1)}
            />
            <Button
              size='small'
              icon={<Icon.Trash size={16} />}
              label={__('Remove', 'subtleforms')}
              isDestructive
              disabled={isReadOnly}
              onClick={() => save(list.filter((_, j) => j !== i))}
            />
          </div>
          <span className='sf-confirmations__label'>{__('Show when', 'subtleforms')}</span>
          <LogicEditor
            logic={c.logic}
            availableFields={fields}
            showAction={false}
            disabled={isReadOnly}
            emptyText={__('Add a rule. A confirmation without rules is never used.', 'subtleforms')}
            onChange={(logic) => patch(i, { logic })}
          />
          <ToggleGroupControl
            __nextHasNoMarginBottom
            __next40pxDefaultSize
            isBlock
            label={__('Show visitors', 'subtleforms')}
            value={c.type || 'message'}
            onChange={(v) => !isReadOnly && patch(i, { type: v })}>
            <ToggleGroupControlOption value='message' label={__('A message', 'subtleforms')} />
            <ToggleGroupControlOption value='redirect' label={__('Another page', 'subtleforms')} />
          </ToggleGroupControl>
          {(c.type || 'message') === 'message' ? (
            <>
              <TextControl
                __nextHasNoMarginBottom
                __next40pxDefaultSize
                label={__('Heading', 'subtleforms')}
                value={c.title ?? ''}
                disabled={isReadOnly}
                onChange={(v) => patch(i, { title: v })}
              />
              <TextareaControl
                __nextHasNoMarginBottom
                label={__('Message', 'subtleforms')}
                value={c.message ?? ''}
                rows={3}
                disabled={isReadOnly}
                onChange={(v) => patch(i, { message: v })}
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
              disabled={isReadOnly}
              onChange={(v) => patch(i, { redirectUrl: v })}
            />
          )}
        </div>
      ))}

      <Button variant='secondary' size='compact' disabled={isReadOnly} onClick={add} className='sf-confirmations__add'>
        {__('Add conditional confirmation', 'subtleforms')}
      </Button>
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

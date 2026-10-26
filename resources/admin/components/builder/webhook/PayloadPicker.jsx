/**
 * "Data to send" of a webhook (2.5.0): tick what the endpoint receives, see
 * the exact JSON for an example entry, or edit the same body as JSON.
 *
 * Three stored modes: `full` (the standard body, what every webhook sent
 * before), `selected` (the ticked keys in payload_selection) and `custom`
 * (a JSON template with merge tags). Saved webhooks keep their mode; ticking
 * a box moves a `full` webhook to `selected` starting from the same data.
 */
import { useMemo, useState } from '@wordpress/element';
import { Button, CheckboxControl, TextareaControl, Notice } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import {
  FIELD_PREFIX,
  LABELS_OPTION,
  buildFullPreview,
  buildPreview,
  cleanSelection,
  defaultSelection,
  fullSelection,
  keyGroups,
  renderTemplate,
  sampleEntry,
  selectionToTemplate,
  templateToSelection,
} from './webhookModel';

export function payloadMode(settings) {
  return ['selected', 'custom'].includes(settings?.payload_mode) ? settings.payload_mode : 'full';
}

/** The ticks that apply to the stored settings, for any mode. */
export function currentSelection(settings, fields, addonGroups) {
  const mode = payloadMode(settings);
  if (mode === 'selected') return cleanSelection(settings.payload_selection, fields, addonGroups);
  if (mode === 'full') return fullSelection(fields);
  const converted = templateToSelection(settings.custom_payload || '', fields, addonGroups);
  return converted.kind === 'selection' ? converted.selection : [];
}

function Group({ title, children }) {
  return (
    <fieldset className='sf-webhook-group'>
      <legend className='sf-webhook-group__title'>{title}</legend>
      <div className='sf-webhook-group__items'>{children}</div>
    </fieldset>
  );
}

export default function PayloadPicker({ settings, fields, addonGroups, formId, formTitle, siteUrl, disabled, patch }) {
  const mode = payloadMode(settings);
  const [view, setView] = useState(mode === 'custom' ? 'json' : 'checkboxes');
  const [jsonText, setJsonText] = useState(() => (mode === 'custom' ? settings.custom_payload || '' : ''));
  const [jsonError, setJsonError] = useState('');

  const entry = useMemo(() => sampleEntry({ formId, formTitle, siteUrl }, addonGroups), [formId, formTitle, siteUrl, addonGroups]);
  const selection = currentSelection(settings, fields, addonGroups);
  const picked = new Set(selection);

  const setSelection = (next) => patch({ payload_mode: 'selected', payload_selection: cleanSelection(next, fields, addonGroups) });
  const toggle = (key, on) => setSelection(on ? [...selection, key] : selection.filter((k) => k !== key));
  const answerKeys = fields.map((f) => FIELD_PREFIX + f.key);
  const allAnswersOn = answerKeys.length > 0 && answerKeys.every((k) => picked.has(k));

  // What the JSON view says about itself.
  const asSelection = view === 'json' ? templateToSelection(jsonText, fields, addonGroups) : null;
  const isCustom = view === 'json' && asSelection && asSelection.kind === 'custom';

  const openJson = () => {
    const text = mode === 'custom' ? settings.custom_payload || '' : selectionToTemplate(selection, fields);
    setJsonText(text);
    setJsonError('');
    setView('json');
  };

  const backToCheckboxes = () => {
    if (!asSelection || asSelection.kind !== 'selection') return;
    // Only a body that was edited becomes ticks again; looking at the JSON of
    // a standard or ticked webhook changes nothing.
    if (mode === 'custom' && !jsonError) setSelection(asSelection.selection);
    setView('checkboxes');
  };

  const startOver = () => {
    setSelection(defaultSelection(fields));
    setJsonError('');
    setView('checkboxes');
  };

  const editJson = (text) => {
    setJsonText(text);
    try {
      JSON.parse(text);
    } catch (e) {
      setJsonError(__('This is not valid JSON yet. What you typed is kept, but it is not saved until it is valid.', 'subtleforms'));
      return;
    }
    setJsonError('');
    patch({ payload_mode: 'custom', custom_payload: text });
  };

  // The example the preview shows: what would be sent for the stored mode.
  let preview;
  let previewNote = '';
  if (view === 'json') {
    const rendered = renderTemplate(jsonText, fields, entry);
    preview = rendered.ok ? rendered.value : null;
    previewNote = rendered.ok ? '' : rendered.error;
  } else if (mode === 'full') {
    preview = buildFullPreview(fields, entry, siteUrl);
  } else {
    preview = buildPreview(selection, fields, entry);
  }

  const groups = keyGroups(addonGroups);

  return (
    <div className='sf-webhook-data'>
      <div className='sf-webhook-section__head'>
        <div>
          <h4 className='sf-webhook-section__title'>{__('Data to send', 'subtleforms')}</h4>
          <p className='sf-webhook-section__help'>
            {view === 'json'
              ? __('This is the body as a template. Merge tags such as {{field:email}} are replaced with each answer.', 'subtleforms')
              : __('Tick what your endpoint should receive. Passwords and signatures are never sent.', 'subtleforms')}
          </p>
        </div>
        <Button
          variant='link'
          onClick={view === 'json' ? backToCheckboxes : openJson}
          disabled={disabled || (view === 'json' && (isCustom || !!jsonError))}>
          {view === 'json' ? __('Back to checkboxes', 'subtleforms') : __('View as JSON', 'subtleforms')}
        </Button>
      </div>

      {view === 'checkboxes' && mode === 'full' && (
        <p className='sf-webhook-note'>
          {__('This webhook sends the standard body, which also has the site address and a link to the entry. Change a tick to choose your own data instead.', 'subtleforms')}
        </p>
      )}

      {view === 'json' && isCustom && (
        <Notice status='warning' isDismissible={false} className='sf-webhook-notice'>
          <strong>{__('Custom JSON.', 'subtleforms')}</strong>{' '}
          {__('The checkboxes are off because this body does not match them.', 'subtleforms')} {asSelection.reason}{' '}
          <Button variant='link' onClick={startOver} disabled={disabled}>
            {__('Start over with checkboxes', 'subtleforms')}
          </Button>
        </Notice>
      )}

      {view === 'checkboxes' && (
        <div className='sf-webhook-groups'>
          {groups.map((group) => (
            <Group key={group.id} title={group.title}>
              {group.items.map((item) => (
                <CheckboxControl
                  key={item.key}
                  label={item.label}
                  checked={picked.has(item.key)}
                  disabled={disabled}
                  onChange={(on) => toggle(item.key, on)}
                />
              ))}
            </Group>
          ))}

          <Group title={__('Answers', 'subtleforms')}>
            {fields.length === 0 ? (
              <p className='sf-webhook-note'>{__('This form has no fields yet.', 'subtleforms')}</p>
            ) : (
              <>
                <div className='sf-webhook-group__bulk'>
                  <Button
                    variant='link'
                    disabled={disabled || allAnswersOn}
                    onClick={() => setSelection([...selection.filter((k) => !k.startsWith(FIELD_PREFIX)), ...answerKeys])}>
                    {__('Select all', 'subtleforms')}
                  </Button>
                  <Button
                    variant='link'
                    disabled={disabled || !answerKeys.some((k) => picked.has(k))}
                    onClick={() => setSelection(selection.filter((k) => !k.startsWith(FIELD_PREFIX) && k !== LABELS_OPTION))}>
                    {__('Select none', 'subtleforms')}
                  </Button>
                </div>
                {fields.map((f) => (
                  <CheckboxControl
                    key={f.key}
                    label={f.label}
                    help={f.type === 'repeat_container' ? __('All groups, as one list', 'subtleforms') : undefined}
                    checked={picked.has(FIELD_PREFIX + f.key)}
                    disabled={disabled}
                    onChange={(on) => toggle(FIELD_PREFIX + f.key, on)}
                  />
                ))}
                <CheckboxControl
                  className='sf-webhook-group__option'
                  label={__('Send field labels with values', 'subtleforms')}
                  help={__('Adds an "answers" list with each ticked field name, label and value.', 'subtleforms')}
                  checked={picked.has(LABELS_OPTION)}
                  disabled={disabled || !answerKeys.some((k) => picked.has(k))}
                  onChange={(on) => toggle(LABELS_OPTION, on)}
                />
              </>
            )}
          </Group>
        </div>
      )}

      {view === 'json' && (
        <>
          <TextareaControl
            label={__('Body as JSON', 'subtleforms')}
            hideLabelFromVision
            className='sf-webhook-code'
            value={jsonText}
            rows={12}
            onChange={editJson}
            disabled={disabled}
            spellCheck={false}
          />
          {jsonError && (
            <p className='sf-webhook-headers__error' role='alert'>
              {jsonError}
            </p>
          )}
        </>
      )}

      <div className='sf-webhook-preview'>
        <h4 className='sf-webhook-section__title'>{__('Data that will be sent', 'subtleforms')}</h4>
        <p className='sf-webhook-section__help'>
          {sprintf(
            /* translators: %s: the HTTP method, for example POST */
            __('An example entry. Real values come from each submission. Sent as the body of a %s request.', 'subtleforms'),
            settings.method || 'POST'
          )}
        </p>
        {preview ? (
          <pre className='sf-webhook-preview__code' tabIndex={0} aria-label={__('Data that will be sent', 'subtleforms')}>
            {JSON.stringify(preview, null, 2)}
          </pre>
        ) : (
          <p className='sf-webhook-note'>{previewNote}</p>
        )}
      </div>
    </div>
  );
}

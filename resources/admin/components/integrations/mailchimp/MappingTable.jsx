import { SelectControl, Button } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

const fieldOf = (rows, tag) => (rows || []).find((r) => String(r.target || '').toUpperCase() === tag)?.field || '';

/**
 * Set the form field for a Mailchimp merge tag, keeping the other rows (and
 * their order) as they are. An empty field removes the row.
 *
 * @param {Array}  rows  Mapping rows { field, target }.
 * @param {string} tag   Merge tag.
 * @param {string} field Form field key, or '' to remove.
 * @return {Array} New rows.
 */
export function setMergeRow(rows, tag, field) {
  const list = Array.isArray(rows) ? rows : [];
  const exists = list.some((r) => String(r.target || '').toUpperCase() === tag);
  if (!field) {
    return list.filter((r) => String(r.target || '').toUpperCase() !== tag);
  }
  if (!exists) {
    return [...list, { field, target: tag }];
  }
  return list.map((r) => (String(r.target || '').toUpperCase() === tag ? { ...r, field } : r));
}

/**
 * The field mapping table: Email, First name, Last name, then every merge
 * field of the chosen audience, each with a "Form field" dropdown.
 *
 * @param {Object}   props
 * @param {Object}   props.config        The form's Mailchimp settings.
 * @param {Function} props.patch         Merge values into the settings.
 * @param {Array}    props.fieldOptions  Every field of the form { label, value }.
 * @param {Array}    props.emailOptions  Email fields of the form { label, value }.
 * @param {Array}    props.mergeFields   Merge fields of the audience { tag, name, required }.
 * @param {boolean}  props.mergeLoading  Merge fields are loading.
 * @param {string}   props.mergeError    Why they could not load.
 * @param {boolean}  props.disabled      Read only.
 */
export default function MappingTable({ config, patch, fieldOptions, emailOptions, mergeFields, mergeLoading, mergeError, disabled }) {
  const fields = config.fields || {};
  const rows = Array.isArray(config.merge_fields) ? config.merge_fields : [];
  const auto = (label) => [{ label, value: '' }];
  const notSent = [{ label: __('Not sent', 'subtleforms'), value: '' }];

  const known = new Set((mergeFields || []).map((f) => f.tag));
  const orphans = rows.filter((r) => r.target && !known.has(String(r.target).toUpperCase()));

  const setIdentity = (name, value) => patch({ fields: { ...fields, [name]: value } });

  return (
    <div className='sf-mc-map' role='group' aria-label={__('Field mapping', 'subtleforms')}>
      <div className='sf-mc-map__head' aria-hidden='true'>
        <span>{__('Mailchimp field', 'subtleforms')}</span>
        <span>{__('Form field', 'subtleforms')}</span>
      </div>

      <div className='sf-mc-map__row'>
        <span className='sf-mc-map__target'>
          {__('Email', 'subtleforms')} <em>{__('required', 'subtleforms')}</em>
        </span>
        <SelectControl
          label={__('Form field for Email', 'subtleforms')}
          hideLabelFromVision
          value={fields.email || ''}
          options={[...auto(__('First email field in the form', 'subtleforms')), ...emailOptions]}
          onChange={(v) => setIdentity('email', v)}
          disabled={disabled}
          help={emailOptions.length === 0 ? __('This form has no Email field. Add one so people can be subscribed.', 'subtleforms') : undefined}
        />
      </div>

      <div className='sf-mc-map__row'>
        <span className='sf-mc-map__target'>{__('First name', 'subtleforms')}</span>
        <SelectControl
          label={__('Form field for First name', 'subtleforms')}
          hideLabelFromVision
          value={fields.first_name || ''}
          options={[...auto(__('Detect automatically', 'subtleforms')), ...fieldOptions]}
          onChange={(v) => setIdentity('first_name', v)}
          disabled={disabled}
        />
      </div>

      <div className='sf-mc-map__row'>
        <span className='sf-mc-map__target'>{__('Last name', 'subtleforms')}</span>
        <SelectControl
          label={__('Form field for Last name', 'subtleforms')}
          hideLabelFromVision
          value={fields.last_name || ''}
          options={[...auto(__('Detect automatically', 'subtleforms')), ...fieldOptions]}
          onChange={(v) => setIdentity('last_name', v)}
          disabled={disabled}
        />
      </div>

      {(mergeFields || []).map((f) => (
        <div className='sf-mc-map__row' key={f.tag}>
          <span className='sf-mc-map__target'>
            {f.name} <code>{f.tag}</code>
          </span>
          <SelectControl
            label={sprintf(
              /* translators: %s: Mailchimp field name */
              __('Form field for %s', 'subtleforms'),
              f.name
            )}
            hideLabelFromVision
            value={fieldOf(rows, f.tag)}
            options={[...notSent, ...fieldOptions]}
            onChange={(v) => patch({ merge_fields: setMergeRow(rows, f.tag, v) })}
            disabled={disabled}
          />
        </div>
      ))}

      {orphans.map((r) => (
        <div className='sf-mc-map__row sf-mc-map__row--orphan' key={`orphan-${r.target}`}>
          <span className='sf-mc-map__target'>
            <code>{String(r.target).toUpperCase()}</code>{' '}
            <em>{mergeLoading || mergeError ? __('saved', 'subtleforms') : __('not in this audience', 'subtleforms')}</em>
          </span>
          <div className='sf-mc-map__orphan-control'>
            <SelectControl
              label={sprintf(
                /* translators: %s: Mailchimp merge tag */
                __('Form field for %s', 'subtleforms'),
                r.target
              )}
              hideLabelFromVision
              value={r.field || ''}
              options={[...notSent, ...fieldOptions]}
              onChange={(v) => patch({ merge_fields: setMergeRow(rows, String(r.target).toUpperCase(), v) })}
              disabled={disabled}
            />
            {!disabled && (
              <Button
                variant='tertiary'
                size='compact'
                isDestructive
                onClick={() => patch({ merge_fields: setMergeRow(rows, String(r.target).toUpperCase(), '') })}>
                {__('Remove', 'subtleforms')}
              </Button>
            )}
          </div>
        </div>
      ))}

      {mergeLoading && (
        <p className='sf-mc-map__note' role='status'>
          {__('Loading the audience fields…', 'subtleforms')}
        </p>
      )}
      {mergeError && <p className='sf-mc-map__note sf-mc-map__note--error'>{mergeError}</p>}
      {!mergeLoading && !mergeError && (mergeFields || []).length === 0 && fields && (
        <p className='sf-mc-map__note'>
          {__('This audience has no other fields. Add merge fields in Mailchimp under Audience, Settings, Audience fields, then refresh.', 'subtleforms')}
        </p>
      )}
    </div>
  );
}

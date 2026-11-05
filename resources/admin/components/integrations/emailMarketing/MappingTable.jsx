import { SelectControl, Button } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { uiFor } from './serviceUi';

/** How a mapped field name is compared: capitals for Mailchimp and Brevo, as typed for Kit. */
const norm = (value, upper) => (upper ? String(value || '').toUpperCase() : String(value || ''));

const fieldOf = (rows, tag, upper = true) => (rows || []).find((r) => norm(r.target, upper) === tag)?.field || '';

/**
 * Set the form field for a service's field (Mailchimp merge tag, Brevo
 * attribute, Kit custom field), keeping the other rows (and their order) as
 * they are. An empty field removes the row.
 *
 * @param {Array}   rows  Mapping rows { field, target }.
 * @param {string}  tag   Field name at the service.
 * @param {string}  field Form field key, or '' to remove.
 * @param {boolean} upper Compare names in capitals (Mailchimp, Brevo).
 * @return {Array} New rows.
 */
export function setMergeRow(rows, tag, field, upper = true) {
  const list = Array.isArray(rows) ? rows : [];
  const same = (r) => norm(r.target, upper) === norm(tag, upper);
  const exists = list.some(same);
  if (!field) {
    return list.filter((r) => !same(r));
  }
  if (!exists) {
    return [...list, { field, target: norm(tag, upper) }];
  }
  return list.map((r) => (same(r) ? { ...r, field } : r));
}

/**
 * The field mapping table: Email, First name, Last name, then every field
 * the service reports (merge fields of the audience, contact attributes,
 * custom fields), each with a "Form field" dropdown.
 *
 * @param {Object}   props
 * @param {string}   props.service       Service slug.
 * @param {Object}   props.config        The form's settings for the service.
 * @param {Function} props.patch         Merge values into the settings.
 * @param {Array}    props.fieldOptions  Every field of the form { label, value }.
 * @param {Array}    props.emailOptions  Email fields of the form { label, value }.
 * @param {Array}    props.mergeFields   Merge fields of the audience { tag, name, required }.
 * @param {boolean}  props.mergeLoading  Merge fields are loading.
 * @param {string}   props.mergeError    Why they could not load.
 * @param {boolean}  props.disabled      Read only.
 */
export default function MappingTable({ service = 'mailchimp', config, patch, fieldOptions, emailOptions, mergeFields, mergeLoading, mergeError, disabled }) {
  const ui = uiFor(service);
  const upper = ui.upper;
  const fields = config.fields || {};
  const rows = Array.isArray(config.merge_fields) ? config.merge_fields : [];
  const auto = (label) => [{ label, value: '' }];
  const notSent = [{ label: __('Not sent', 'subtleforms'), value: '' }];

  const known = new Set((mergeFields || []).map((f) => norm(f.tag, upper)));
  const orphans = rows.filter((r) => r.target && !known.has(norm(r.target, upper)));

  const setIdentity = (name, value) => patch({ fields: { ...fields, [name]: value } });

  return (
    <div className='sf-em-map' role='group' aria-label={__('Field mapping', 'subtleforms')}>
      <div className='sf-em-map__head' aria-hidden='true'>
        <span>{ui.fieldHeader}</span>
        <span>{__('Form field', 'subtleforms')}</span>
      </div>

      <div className='sf-em-map__row'>
        <span className='sf-em-map__target'>
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

      <div className='sf-em-map__row'>
        <span className='sf-em-map__target'>{__('First name', 'subtleforms')}</span>
        <SelectControl
          label={__('Form field for First name', 'subtleforms')}
          hideLabelFromVision
          value={fields.first_name || ''}
          options={[...auto(__('Detect automatically', 'subtleforms')), ...fieldOptions]}
          onChange={(v) => setIdentity('first_name', v)}
          disabled={disabled}
        />
      </div>

      <div className='sf-em-map__row'>
        <span className='sf-em-map__target'>{__('Last name', 'subtleforms')}</span>
        <SelectControl
          label={__('Form field for Last name', 'subtleforms')}
          hideLabelFromVision
          value={fields.last_name || ''}
          options={[...auto(ui.lastNameNote ? __('Not sent', 'subtleforms') : __('Detect automatically', 'subtleforms')), ...fieldOptions]}
          onChange={(v) => setIdentity('last_name', v)}
          disabled={disabled}
          help={ui.lastNameNote || undefined}
        />
      </div>

      {(mergeFields || []).map((f) => (
        <div className='sf-em-map__row' key={f.tag}>
          <span className='sf-em-map__target'>
            {f.name} <code>{f.tag}</code>
          </span>
          <SelectControl
            label={sprintf(
              /* translators: %s: name of the field at the service */
              __('Form field for %s', 'subtleforms'),
              f.name
            )}
            hideLabelFromVision
            value={fieldOf(rows, norm(f.tag, upper), upper)}
            options={[...notSent, ...fieldOptions]}
            onChange={(v) => patch({ merge_fields: setMergeRow(rows, f.tag, v, upper) })}
            disabled={disabled}
          />
        </div>
      ))}

      {orphans.map((r) => (
        <div className='sf-em-map__row sf-em-map__row--orphan' key={`orphan-${r.target}`}>
          <span className='sf-em-map__target'>
            <code>{norm(r.target, upper)}</code>{' '}
            <em>{mergeLoading || mergeError ? __('saved', 'subtleforms') : __('not found', 'subtleforms')}</em>
          </span>
          <div className='sf-em-map__orphan-control'>
            <SelectControl
              label={sprintf(
                /* translators: %s: name of the field at the service */
                __('Form field for %s', 'subtleforms'),
                r.target
              )}
              hideLabelFromVision
              value={r.field || ''}
              options={[...notSent, ...fieldOptions]}
              onChange={(v) => patch({ merge_fields: setMergeRow(rows, norm(r.target, upper), v, upper) })}
              disabled={disabled}
            />
            {!disabled && (
              <Button
                variant='tertiary'
                size='compact'
                isDestructive
                onClick={() => patch({ merge_fields: setMergeRow(rows, norm(r.target, upper), '', upper) })}>
                {__('Remove', 'subtleforms')}
              </Button>
            )}
          </div>
        </div>
      ))}

      {mergeLoading && (
        <p className='sf-em-map__note' role='status'>
          {__('Loading the audience fields…', 'subtleforms')}
        </p>
      )}
      {mergeError && <p className='sf-em-map__note sf-em-map__note--error'>{mergeError}</p>}
      {!mergeLoading && !mergeError && (mergeFields || []).length === 0 && fields && (
        <p className='sf-em-map__note'>
          {ui.noFields}
        </p>
      )}
    </div>
  );
}
